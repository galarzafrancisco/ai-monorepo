import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { Agent, run } from '@openai/agents';
import { AgentsService } from 'src/agents/agents.service';
import { AgentResult } from 'src/agents/dto/service/agents.service.types';
import { IssuedAccessTokenService } from 'src/authorization-server/issued-access-token.service';
import { McpScopes } from 'src/auth/core/scopes/mcp.scopes';
import { ALL_TASKS_SCOPES } from 'src/tasks/tasks.scopes';
import { ALL_CONTEXT_SCOPES } from 'src/context/context.scopes';
import { getConfig, isThreadStateReconcilerEnabled } from 'src/config/env.config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ActorEntity } from 'src/identity-provider/actor.entity';
import { ActorType } from 'src/identity-provider/enums';
import { OpenAiMcpServerFactoryService } from './openai-mcp-server-factory.service';
import { ThreadsService } from './threads.service';
import { CommentAddedEvent, TaskStatusChangedEvent } from '../tasks/events/tasks.events';
import { ThreadResult } from './dto/service/threads.service.types';
import { KeyedDebounceBatchProcessor } from '../common/utils/keyed-debounce-batch-processor.util';

type TaskActivityKind = 'comment_added' | 'status_changed';

type ReconcileThreadStateInput = {
  threadId: string;
  taskId: string;
  actorId: string;
  kind: TaskActivityKind;
  activitySummary: string;
};

type BuildPromptInput = {
  thread: ThreadResult;
  activitySummary: string;
  kind: TaskActivityKind;
  taskId: string;
};

type SelfActorInfo = {
  id: string;
  slug: string;
  type: ActorType.AGENT;
  displayName: string;
};

@Injectable()
export class ThreadStateReconcilerService {
  private readonly logger = new Logger(ThreadStateReconcilerService.name);
  private readonly activityBatcher: KeyedDebounceBatchProcessor<
    string,
    ReconcileThreadStateInput
  >;

  constructor(
    private readonly agentsService: AgentsService,
    private readonly threadsService: ThreadsService,
    private readonly issuedAccessTokenService: IssuedAccessTokenService,
    private readonly openAiMcpServerFactoryService: OpenAiMcpServerFactoryService,
    @InjectRepository(ActorEntity)
    private readonly actorRepository: Repository<ActorEntity>,
  ) {
    this.activityBatcher = new KeyedDebounceBatchProcessor({
      delayMs: getConfig().threadStateReconcilerDebounceMs,
      handleBatch: async (threadId, items) => {
        await this.reconcileThreadStateBatch(threadId, items);
      },
      onError: (threadId, error) => {
        this.logger.warn({
          message: 'Thread state activity batch failed',
          threadId,
          error: { message: error.message, stack: error.stack },
        });
      },
    });
  }

  onModuleDestroy(): void {
    this.activityBatcher.dispose();
  }

  private async getSelf(): Promise<AgentResult> {
    return this.agentsService.getAgentBySlug({ slug: 'taico' });
  }

  private getInstructions(): string {
    return `You are a thread state middle manager.

Goal:
- Decide whether the latest task activity is important enough to be reflected in thread state memory.
- If it is relevant, reconcile and update the thread state block.
- If it is not relevant, do nothing.

Definition of relevant:
- New decisions, constraints, dependencies, blockers, scope changes, requirement clarifications, owner changes, deadlines, or completion signals that affect sibling tasks.
- Ignore low-signal chatter, acknowledgements, and purely local details.

Required process:
1) Read the current state block.
2) Read the triggering task and, if needed, other thread tasks.
3) Decide relevance.
4) If relevant, update the state block with concise, durable memory:
   - Shared goals
   - Current decisions
   - Open blockers/risks
   - Cross-task coordination notes

Tools available through MCP:
- tasks__fetch
- tasks__list_tasks_filtered
- context__get_block
- context__update_block

When updating:
- Keep the state concise and structured.
- Preserve valuable existing state; do not erase useful context.
- Output no prose to the user; use tools for side effects only.`;
  }

  private buildPrompt(input: BuildPromptInput): string {
    const taskSummaries = input.thread.tasks
      .map((task) => `- ${task.id}: ${task.name} [${task.status}]`)
      .join('\n');

    return `Thread state reconciliation request

Thread:
- threadId: ${input.thread.id}
- title: ${input.thread.title}
- parentTaskId: ${input.thread.parentTaskId ?? 'none'}
- stateContextBlockId: ${input.thread.stateContextBlockId}

Thread tasks:
${taskSummaries || '- none'}

Triggering activity:
- kind: ${input.kind}
- taskId: ${input.taskId}
- summary: ${input.activitySummary}

Now run the required process. If relevant, update the state block with context__update_block.`;
  }

  private async reconcileThreadStateBatch(
    threadId: string,
    items: ReconcileThreadStateInput[],
  ): Promise<void> {
    if (items.length === 0) {
      return;
    }

    const thread = await this.threadsService.getThreadById(threadId);
    const latestItem = items[items.length - 1];
    const self = await this.getSelf();
    const selfActor: SelfActorInfo = {
      id: self.actorId,
      slug: self.slug,
      type: ActorType.AGENT,
      displayName: self.name,
    };

    const issuedByActor = await this.actorRepository.findOne({
      where: { id: latestItem.actorId },
    });

    const token = await this.issuedAccessTokenService.issueSystemToken({
      subjectActor: selfActor,
      issuedByActor: issuedByActor
        ? {
            id: issuedByActor.id,
            slug: issuedByActor.slug,
            type: issuedByActor.type,
            displayName: issuedByActor.displayName,
          }
        : selfActor,
      scopes: [
        McpScopes.USE.id,
        ...ALL_TASKS_SCOPES.map((scope) => scope.id),
        ...ALL_CONTEXT_SCOPES.map((scope) => scope.id),
      ],
    });

    try {
      const mcpServers = await this.openAiMcpServerFactoryService.createServers(
        token,
      );
      const agent = new Agent({
        name: `${self.name} state manager`,
        instructions: this.getInstructions(),
        model: self.modelId || 'gpt-5.2-codex',
        mcpServers,
      });

      await run(
        agent,
        this.buildPrompt({
          thread,
          activitySummary: this.summarizeBatch(items),
          kind: latestItem.kind,
          taskId: latestItem.taskId,
        }),
      );
    } catch (error) {
      this.logger.warn({
        message: 'Thread state reconciliation failed',
        threadId: thread.id,
        taskId: latestItem.taskId,
        kind: latestItem.kind,
        error:
          error instanceof Error
            ? { message: error.message, stack: error.stack }
            : String(error),
      });
    }
  }

  private summarizeBatch(items: ReconcileThreadStateInput[]): string {
    const lines = items
      .slice(-20)
      .map((item) => `[${item.kind}] task ${item.taskId}: ${item.activitySummary}`);

    return lines.join('\n').slice(0, 4_000);
  }

  private async enqueueActivity(
    input: Omit<ReconcileThreadStateInput, 'threadId'>,
  ): Promise<void> {
    const thread = await this.threadsService.findThreadByTaskId(input.taskId);
    if (!thread) {
      return;
    }

    this.activityBatcher.enqueue(thread.id, {
      threadId: thread.id,
      taskId: input.taskId,
      actorId: input.actorId,
      kind: input.kind,
      activitySummary: input.activitySummary,
    });
  }

  @OnEvent(CommentAddedEvent.INTERNAL)
  async onCommentAdded(event: CommentAddedEvent): Promise<void> {
    if (!isThreadStateReconcilerEnabled()) {
      return;
    }

    const summary = event.payload.content.length > 800
      ? `${event.payload.content.slice(0, 800)}...`
      : event.payload.content;

    await this.enqueueActivity({
      taskId: event.payload.taskId,
      actorId: event.actor.id,
      kind: 'comment_added',
      activitySummary: summary,
    });
  }

  @OnEvent(TaskStatusChangedEvent.INTERNAL)
  async onTaskStatusChanged(event: TaskStatusChangedEvent): Promise<void> {
    if (!isThreadStateReconcilerEnabled()) {
      return;
    }

    await this.enqueueActivity({
      taskId: event.payload.id,
      actorId: event.actor.id,
      kind: 'status_changed',
      activitySummary: `Task ${event.payload.name} changed status to ${event.payload.status}.`,
    });
  }
}
