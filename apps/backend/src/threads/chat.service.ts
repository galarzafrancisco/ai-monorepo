import { Injectable, Logger } from '@nestjs/common';
import { generateText, isStepCount } from 'ai';
import { AgentsService } from 'src/agents/agents.service';
import { AgentResult } from 'src/agents/dto/service/agents.service.types';
import { ActorEntity } from 'src/identity-provider/actor.entity';
import { ActorType } from 'src/identity-provider/enums';
import { AiModelJob } from 'src/ai-providers/enums';
import { AiModelNotSelectedError } from 'src/ai-providers/errors/ai-providers.errors';
import { ChatModelFactory } from './agent/chat-model.factory';
import { McpActor, TaicoMcpToolsFactory } from './agent/taico-mcp-tools.factory';
import {
  THREAD_AGENT_MAX_STEPS,
  THREAD_AGENT_SLUG,
} from './agent/thread-agent.service';

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

  /** One-shot text generation with no tools, on the quick tasks model. Returns null on failure. */
  public async generateText(prompt: string): Promise<string | null> {
    try {
      const resolved = await this.chatModelFactory.resolve({ job: AiModelJob.QUICK_TASKS });
      const result = await generateText({
        model: resolved.model,
        prompt,
        providerOptions: resolved.providerOptions,
      });
      return result.text.trim() || null;
    } catch (error) {
      if (!(error instanceof AiModelNotSelectedError)) {
        this.logger.warn({
          message: 'Text generation failed',
          error: error instanceof Error
            ? { message: error.message, name: error.name }
            : String(error),
        });
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
  }): Promise<void> {
    const self = await this.getSelf();
    const resolved = await this.chatModelFactory.resolve({ job: AiModelJob.MIDDLE_MANAGER });

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
    try {
      await generateText({
        model: resolved.model,
        instructions: args.instructions,
        prompt: args.prompt,
        tools: mcp.tools,
        providerOptions: resolved.providerOptions,
        stopWhen: isStepCount(THREAD_AGENT_MAX_STEPS),
      });
    } finally {
      await mcp.close();
    }
  }
}
