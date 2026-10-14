import { Injectable, Logger } from '@nestjs/common';
import { generateText, isStepCount, streamText } from 'ai';
import { AgentsService } from 'src/agents/agents.service';
import { AgentResult } from 'src/agents/dto/service/agents.service.types';
import { ActorEntity } from 'src/identity-provider/actor.entity';
import { ActorType } from 'src/identity-provider/enums';
import { AiModelJob } from 'src/ai-providers/enums';
import { AiModelNotSelectedError } from 'src/ai-providers/errors/ai-providers.errors';
import { OnBehalfOf } from 'src/ai-providers/dto/service/ai-providers.service.types';
import { ChatModelFactory } from './agent/chat-model.factory';
import { McpActor, TaicoMcpToolsFactory } from './agent/taico-mcp-tools.factory';
import {
  THREAD_AGENT_MAX_STEPS,
  THREAD_AGENT_SLUG,
} from './agent/thread-agent.service';

/**
 * Which small tasks job a one-shot call runs on.
 * - user: a person started it directly; a provider on a person's own plan
 *   bills that person, and only for calls they started (never unattended).
 * - system: nobody started it; only a provider with an API key may run it.
 */
export type SmallTaskRunFor =
  | {
      job: AiModelJob.USER_SMALL_TASKS;
      onBehalfOf: OnBehalfOf & { automated: false };
    }
  | { job: AiModelJob.SYSTEM_SMALL_TASKS };

/** One-shot LLM calls with no conversation history (titles, thread state reconciliation). */
@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);

  constructor(
    private readonly agentsService: AgentsService,
    private readonly chatModelFactory: ChatModelFactory,
    private readonly mcpToolsFactory: TaicoMcpToolsFactory,
  ) {}

  private async getSelf(): Promise<AgentResult> {
    return this.agentsService.getAgentBySlug({ slug: THREAD_AGENT_SLUG });
  }

  /**
   * One-shot text generation with no tools, on a small tasks model. Returns
   * null on failure, including when a provider that runs on a person's own
   * plan cannot use that person's plan; it never falls back to another
   * provider or job.
   */
  public async generateText(prompt: string, runFor: SmallTaskRunFor): Promise<string | null> {
    try {
      const resolved = await this.chatModelFactory.resolve(
        runFor.job === AiModelJob.USER_SMALL_TASKS
          ? { job: runFor.job, onBehalfOf: runFor.onBehalfOf }
          : { job: runFor.job },
      );
      const request = {
        model: resolved.model,
        prompt,
        providerOptions: resolved.providerOptions,
      };
      const text = resolved.requiresStreaming
        ? await this.streamToEnd(request)
        : (await generateText(request)).text;
      return text.trim() || null;
    } catch (error) {
      const log = {
        message: 'Text generation failed',
        job: runFor.job,
        onBehalfOf:
          runFor.job === AiModelJob.USER_SMALL_TASKS
            ? { actorId: runFor.onBehalfOf.actorId, automated: runFor.onBehalfOf.automated }
            : undefined,
        error: describeError(error),
      };
      // User small tasks left unselected is a choice. System small tasks have
      // no person to fall back on, so a missing model is setup to finish.
      if (error instanceof AiModelNotSelectedError && runFor.job === AiModelJob.USER_SMALL_TASKS) {
        this.logger.debug(log);
      } else {
        this.logger.warn(log);
      }
      return null;
    }
  }

  /**
   * One-shot agentic run with MCP tools, on the middle manager model. Text
   * output is discarded; only side effects matter.
   */
  public async runTask(args: {
    instructions: string;
    prompt: string;
    actor: ActorEntity | null;
    /**
     * Whose plan pays when the middle manager runs on a person's own plan.
     * Without it such a provider refuses the run.
     */
    onBehalfOf?: OnBehalfOf;
  }): Promise<void> {
    const self = await this.getSelf();
    const resolved = await this.chatModelFactory.resolve({
      job: AiModelJob.MIDDLE_MANAGER,
      onBehalfOf: args.onBehalfOf,
    });

    const selfActor: McpActor = {
      id: self.actorId,
      slug: self.slug,
      type: ActorType.AGENT,
      displayName: self.name,
    };
    const issuedBy: McpActor = args.actor
      ? {
          id: args.actor.id,
          slug: args.actor.slug,
          type: args.actor.type,
          displayName: args.actor.displayName,
        }
      : selfActor;

    const mcp = await this.mcpToolsFactory.open({ subject: selfActor, issuedBy });
    const request = {
      model: resolved.model,
      instructions: args.instructions,
      prompt: args.prompt,
      tools: mcp.tools,
      providerOptions: resolved.providerOptions,
      stopWhen: isStepCount(THREAD_AGENT_MAX_STEPS),
    };
    try {
      if (resolved.requiresStreaming) {
        await this.streamToEnd(request);
      } else {
        await generateText(request);
      }
    } finally {
      await mcp.close();
    }
  }

  /**
   * Runs a request on a provider that only streams, reading it to the end,
   * and returns the full text. A failure reported only as a stream part still
   * fails the run, even after some text arrived.
   */
  private async streamToEnd(request: Parameters<typeof streamText>[0]): Promise<string> {
    const failures: unknown[] = [];
    const result = streamText({
      ...request,
      onError: ({ error }) => {
        failures.push(error);
      },
    });
    let text = '';
    try {
      text = await result.text;
    } catch (error) {
      failures.push(error);
    }
    if (failures.length > 0) {
      const [first] = failures;
      throw first instanceof Error ? first : new Error(String(first));
    }
    return text;
  }
}

/** Name, message and error code of a failure, for logs. Never includes tokens. */
function describeError(error: unknown): Record<string, unknown> | string {
  if (!(error instanceof Error)) {
    return String(error);
  }
  const code = (error as { code?: unknown }).code;
  const context = (error as { context?: Record<string, unknown> }).context;
  return {
    name: error.name,
    message: error.message,
    ...(typeof code === 'string' ? { code } : {}),
    ...(typeof context?.upstreamCode === 'string'
      ? { upstreamCode: context.upstreamCode }
      : {}),
  };
}
