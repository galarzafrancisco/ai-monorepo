import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Repository } from 'typeorm';
import { randomUUID } from 'node:crypto';
import { hasToolCall, isStepCount, ModelMessage, streamText, ToolSet } from 'ai';
import { AgentsService } from 'src/agents/agents.service';
import { THREAD_AGENT_SLUG } from 'src/agents/protected-agents';
import { AiModelJob } from 'src/ai-providers/enums';
import { AgentResult } from 'src/agents/dto/service/agents.service.types';
import { ActorType } from 'src/identity-provider/enums';
import { ThreadEntity } from '../thread.entity';
import { ThreadMessageWriterService } from '../thread-message-writer.service';
import {
  MessageCreatedEvent,
  ThreadAgentActivityEvent,
  ThreadAgentActivityKind,
  ThreadAgentResponseDeltaEvent,
  ThreadUpdatedEvent,
} from '../events/threads.events';
import { buildModelMessages, withThreadSecret } from './agent-context.utils';
import { ChatModelFactory, ResolvedChatModel } from './chat-model.factory';
import { TaicoMcpToolsFactory } from './taico-mcp-tools.factory';
import { AgentMessageDraft, ThreadAgentLogService } from './thread-agent-log.service';
import { ThreadAgentMessageRole, ThreadTurnStatus } from './thread-agent.enums';
import { buildThreadScopedInstructions, STAY_SILENT_TOOL } from './thread-agent.prompts';
import { ThreadAgentToolsFactory } from './thread-agent-tools.factory';
import { ClaimedTurn, ThreadTurnsService } from './thread-turns.service';
import { ThreadAgentHooksRunner } from './hooks/thread-agent-hooks.runner';

export { THREAD_AGENT_SLUG };
export const THREAD_AGENT_MAX_STEPS = 25;

type StepOutput = {
  messages: ModelMessage[];
  text: string;
  usage: { inputTokens?: number } | undefined;
};

type TurnOutcome = {
  model: ResolvedChatModel;
  lastInputTokens: number | null;
};

/**
 * Runs the threads agent. Each turn reads the conversation from the agent log,
 * calls the model, and appends every message the model produces. Nothing is
 * kept in memory between turns.
 */
@Injectable()
export class ThreadAgentService {
  private readonly logger = new Logger(ThreadAgentService.name);

  constructor(
    @InjectRepository(ThreadEntity)
    private readonly threadRepository: Repository<ThreadEntity>,
    private readonly messageWriter: ThreadMessageWriterService,
    private readonly agentsService: AgentsService,
    private readonly agentLog: ThreadAgentLogService,
    private readonly turns: ThreadTurnsService,
    private readonly chatModelFactory: ChatModelFactory,
    private readonly mcpToolsFactory: TaicoMcpToolsFactory,
    private readonly threadToolsFactory: ThreadAgentToolsFactory,
    private readonly hooks: ThreadAgentHooksRunner,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * Call after something the agent should react to is saved: a user-facing
   * message or a task notification. Returns immediately.
   */
  requestTurn(threadId: string): void {
    void this.drain(threadId).catch((error) => {
      this.logger.error({
        message: 'Thread agent run failed',
        threadId,
        error: this.describeError(error),
      });
    });
  }

  /**
   * Runs turns until the agent has seen every message. If another turn already
   * holds the thread, that turn's owner picks up the new messages when it is done.
   */
  async drain(threadId: string): Promise<void> {
    const self = await this.agentsService.getAgentBySlug({ slug: THREAD_AGENT_SLUG });

    for (;;) {
      const turn = await this.turns.tryClaim(threadId);
      if (!turn) {
        return;
      }

      const stopHeartbeat = this.turns.startHeartbeat(turn.id);
      try {
        const outcome = await this.runTurn(turn, self);
        if (outcome) {
          // The reply is already with the user; maintenance runs before the thread is released.
          await this.hooks.runAfterTurn({ threadId, turnId: turn.id, ...outcome });
        }
        await this.turns.finish(turn.id, ThreadTurnStatus.COMPLETED);
      } catch (error) {
        const reason = error instanceof Error ? error.message : String(error);
        this.logger.error({
          message: 'Thread agent turn failed',
          threadId,
          turnId: turn.id,
          error: this.describeError(error),
        });
        await this.turns.finish(turn.id, ThreadTurnStatus.FAILED, reason);
        await this.saveDisplayMessage({
          threadId,
          actorId: self.actorId,
          content: `I encountered an error while processing your message: ${reason}`,
          agentMessageId: null,
        });
        return;
      } finally {
        stopHeartbeat();
      }

      // Checked after releasing the claim, so a message that arrived while the
      // turn was finishing is never left without an owner.
      if (
        !(await this.agentLog.hasPending(threadId, self.actorId)) &&
        !(await this.agentLog.hasPendingTaskNotifications(threadId))
      ) {
        return;
      }
    }
  }

  /** Returns null when there was nothing for the agent to answer. */
  private async runTurn(turn: ClaimedTurn, self: AgentResult): Promise<TurnOutcome | null> {
    const { threadId } = turn;

    const { triggerActor: author, newUserMessages } = await this.agentLog.ingestPending({
      threadId,
      agentActorId: self.actorId,
      turnId: turn.id,
    });
    const notifications = await this.agentLog.ingestTaskNotifications({
      threadId,
      turnId: turn.id,
    });
    // A turn started by a task notification acts for whoever the agent subscribed for.
    const triggerActor = author ?? notifications.triggerActor;
    if (!triggerActor) {
      return null;
    }

    const thread = await this.threadRepository.findOne({ where: { id: threadId } });
    if (thread && notifications.notifiedTaskIds.length > 0) {
      // A done task ended its subscription; viewers of the thread see the list change.
      this.eventEmitter.emit(
        ThreadUpdatedEvent.INTERNAL,
        new ThreadUpdatedEvent({ id: self.actorId }, thread),
      );
    }
    const resolved = await this.chatModelFactory.resolve({
      job: AiModelJob.CONVERSATION,
      aiProviderId: thread?.aiProviderId,
      modelId: thread?.modelId,
      // Whose plan a personal-plan provider may use: the author of the newest
      // message, or for a task update, whoever the agent subscribed for.
      onBehalfOf: { actorId: triggerActor.id, automated: !author },
    });

    let rows = await this.agentLog.loadContext(threadId);
    const injected = await this.hooks.runBeforeTurn({
      threadId,
      turnId: turn.id,
      newUserMessages,
      context: rows,
    });
    if (injected) {
      rows = await this.agentLog.loadContext(threadId);
    }
    const threadSecret = await this.agentLog.getOrCreateThreadSecret(threadId);
    const messages = buildModelMessages(withThreadSecret(rows, threadSecret), resolved, (row) => {
      this.logger.warn({
        message: 'Skipping agent log row that does not match the message schema',
        threadId,
        agentMessageId: row.id,
      });
    });

    const mcp = await this.mcpToolsFactory.open({
      subject: {
        id: self.actorId,
        slug: self.slug,
        type: ActorType.AGENT,
        displayName: self.name,
      },
      issuedBy: triggerActor,
    });

    try {
      const lastInputTokens = await this.streamTurn({
        turn,
        self,
        resolved,
        threadSecret,
        messages,
        tools: {
          ...mcp.tools,
          ...this.threadToolsFactory.build({
            threadId,
            agentActorId: self.actorId,
            forActorId: triggerActor.id,
          }),
        },
      });
      return { model: resolved, lastInputTokens };
    } finally {
      await mcp.close();
    }
  }

  private async streamTurn(input: {
    turn: ClaimedTurn;
    self: AgentResult;
    resolved: ResolvedChatModel;
    threadSecret: string;
    messages: ModelMessage[];
    tools: ToolSet;
  }): Promise<number | null> {
    const { turn, self, resolved } = input;
    const { threadId } = turn;

    // Steps are persisted in order, one at a time, as each one completes.
    let persisted: Promise<void> = Promise.resolve();
    let lastInputTokens: number | null = null;

    const result = streamText({
      model: resolved.model,
      instructions: buildThreadScopedInstructions(self.systemPrompt, threadId, input.threadSecret),
      messages: input.messages,
      tools: input.tools,
      providerOptions: resolved.providerOptions,
      stopWhen: [isStepCount(THREAD_AGENT_MAX_STEPS), hasToolCall(STAY_SILENT_TOOL)],
      // Errors arrive as stream parts and are handled below.
      onError: () => undefined,
      onStepEnd: (step) => {
        const output: StepOutput = {
          messages: step.response.messages,
          text: step.text,
          usage: step.usage,
        };
        lastInputTokens = step.usage?.inputTokens ?? lastInputTokens;
        persisted = persisted.then(() => this.persistStep(turn, self, resolved, output));
      },
    });

    let streamId = randomUUID();

    for await (const part of result.stream) {
      switch (part.type) {
        case 'start-step':
          streamId = randomUUID();
          break;
        case 'reasoning-delta':
          this.emitActivity(threadId, self.actorId, 'thinking');
          break;
        case 'tool-call':
          this.emitActivity(threadId, self.actorId, 'tool_calling');
          break;
        case 'text-delta':
          this.eventEmitter.emit(
            ThreadAgentResponseDeltaEvent.INTERNAL,
            new ThreadAgentResponseDeltaEvent(
              { id: self.actorId },
              { threadId, streamId, delta: part.text },
            ),
          );
          break;
        case 'error':
          await persisted;
          throw part.error instanceof Error ? part.error : new Error(String(part.error));
      }
    }

    await persisted;
    return lastInputTokens;
  }

  /** Appends one model step to the agent log and shows its text, if any, to the user. */
  private async persistStep(
    turn: ClaimedTurn,
    self: AgentResult,
    resolved: ResolvedChatModel,
    step: StepOutput,
  ): Promise<void> {
    // The JSON round trip is what the jsonb column would store anyway.
    const messages: ModelMessage[] = JSON.parse(JSON.stringify(step.messages));

    const drafts = messages.map(
      (message): AgentMessageDraft => ({
        role: message.role as ThreadAgentMessageRole,
        message,
        source: 'model',
        turnId: turn.id,
        providerType: resolved.providerType,
        modelId: resolved.modelId,
        usage:
          message.role === 'assistant'
            ? (JSON.parse(JSON.stringify(step.usage ?? null)) as Record<string, unknown> | null)
            : null,
      }),
    );

    const saved = await this.agentLog.append(turn.threadId, drafts);

    const text = step.text.trim();
    const assistantRow = saved.find((row) => row.role === ThreadAgentMessageRole.ASSISTANT);
    if (text && assistantRow) {
      await this.saveDisplayMessage({
        threadId: turn.threadId,
        actorId: self.actorId,
        content: text,
        agentMessageId: assistantRow.id,
      });
    }
  }

  private async saveDisplayMessage(input: {
    threadId: string;
    actorId: string;
    content: string;
    agentMessageId: string | null;
  }): Promise<void> {
    try {
      const withRelations = await this.messageWriter.write({
        threadId: input.threadId,
        content: input.content,
        createdByActorId: input.actorId,
        agentMessageId: input.agentMessageId,
      });

      this.eventEmitter.emit(
        MessageCreatedEvent.INTERNAL,
        new MessageCreatedEvent({ id: input.actorId }, withRelations),
      );
    } catch (error) {
      this.logger.error({
        message: 'Failed to persist agent message',
        threadId: input.threadId,
        error: this.describeError(error),
      });
    }
  }

  private emitActivity(
    threadId: string,
    actorId: string,
    kind: ThreadAgentActivityKind,
  ): void {
    this.eventEmitter.emit(
      ThreadAgentActivityEvent.INTERNAL,
      new ThreadAgentActivityEvent({ id: actorId }, { threadId, kind }),
    );
  }

  private describeError(error: unknown): unknown {
    return error instanceof Error
      ? { message: error.message, stack: error.stack, name: error.name }
      : String(error);
  }
}
