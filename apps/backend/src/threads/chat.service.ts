import { Injectable, Logger } from '@nestjs/common';
import { IssuedAccessTokenService } from 'src/authorization-server/issued-access-token.service';
import { AgentsService } from 'src/agents/agents.service';
import { AgentResult } from 'src/agents/dto/service/agents.service.types';
import { ActorEntity } from 'src/identity-provider/actor.entity';
import { ActorType } from 'src/identity-provider/enums';
import { McpScopes } from 'src/auth/core/scopes/mcp.scopes';
import { ALL_TASKS_SCOPES } from 'src/tasks/tasks.scopes';
import { ALL_CONTEXT_SCOPES } from 'src/context/context.scopes';
import { ChatProvidersService } from 'src/chat-providers/chat-providers.service';
import { NoActiveChatProviderError } from 'src/chat-providers/errors/chat-providers.errors';
import { ChatProviderType } from 'src/chat-providers/enums';
import { AdkBackend } from './backends/adk.backend';
import { OpenAiBackend } from './backends/openai.backend';
import { ChatBackend, ChatStreamEvent } from './backends/chat-backend.interface';

export type { ChatStreamEvent };

export interface CreateConversationArgs {
  threadId: string;
}

export interface StreamMessageToConversationArgs {
  conversationId: string;
  threadId: string;
  message: string;
  actor: ActorEntity;
}

export interface StreamMessageResult {
  agentActorId: string;
  events: AsyncIterable<ChatStreamEvent>;
}

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);

  constructor(
    private readonly agentsService: AgentsService,
    private readonly issuedAccessTokenService: IssuedAccessTokenService,
    private readonly chatProvidersService: ChatProvidersService,
    private readonly adkBackend: AdkBackend,
    private readonly openAiBackend: OpenAiBackend,
  ) {}

  private async getSelf(): Promise<AgentResult> {
    return this.agentsService.getAgentBySlug({ slug: 'taico' });
  }

  private async getActiveBackend(): Promise<ChatBackend> {
    const config = await this.chatProvidersService.getActiveChatProviderConfig();
    return config.type === ChatProviderType.ADK ? this.adkBackend : this.openAiBackend;
  }

  public async ensureConversationAvailable(): Promise<void> {
    try {
      const backend = await this.getActiveBackend();
      await backend.ensureAvailable();
    } catch (error) {
      if (error instanceof NoActiveChatProviderError) {
        return; // No provider configured yet — thread creation can still proceed
      }
      throw error;
    }
  }

  public async createConversation({ threadId }: CreateConversationArgs): Promise<{ id: string }> {
    const backend = await this.getActiveBackend();

    try {
      return await backend.createConversation(threadId);
    } catch (error) {
      this.logger.error({
        message: 'Failed to create conversation',
        threadId,
        error: error instanceof Error
          ? { message: error.message, stack: error.stack, name: error.name }
          : String(error),
      });
      throw error;
    }
  }

  public async generateText(prompt: string): Promise<string | null> {
    try {
      const self = await this.getSelf();
      const backend = await this.getActiveBackend();
      return backend.generateText(prompt, self.modelId);
    } catch (error) {
      if (error instanceof NoActiveChatProviderError) {
        return null;
      }
      throw error;
    }
  }

  public async runTask(args: {
    instructions: string;
    prompt: string;
    actor: ActorEntity | null;
  }): Promise<void> {
    const self = await this.getSelf();
    const backend = await this.getActiveBackend();

    const selfActor = {
      id: self.actorId,
      slug: self.slug,
      type: ActorType.AGENT,
      displayName: self.name,
    };

    const issuedByActor = args.actor
      ? {
          id: args.actor.id,
          slug: args.actor.slug,
          type: args.actor.type,
          displayName: args.actor.displayName,
        }
      : selfActor;

    const token = await this.issuedAccessTokenService.issueSystemToken({
      subjectActor: selfActor,
      issuedByActor,
      scopes: [
        McpScopes.USE.id,
        ...ALL_TASKS_SCOPES.map((s) => s.id),
        ...ALL_CONTEXT_SCOPES.map((s) => s.id),
      ],
    });

    await backend.runTask({
      instructions: args.instructions,
      prompt: args.prompt,
      token: token.token,
      modelId: self.modelId,
    });
  }

  public async streamMessageToConversation(
    args: StreamMessageToConversationArgs,
  ): Promise<StreamMessageResult> {
    const self = await this.getSelf();

    if (args.actor.id === self.actorId) {
      this.logger.debug(
        `Actor ${args.actor.id} is the same as the agent itself. Skipping to avoid loops.`,
      );
      return {
        agentActorId: self.actorId,
        events: (async function* (): AsyncGenerator<ChatStreamEvent> {})(),
      };
    }

    const backend = await this.getActiveBackend();

    const token = await this.issuedAccessTokenService.issueSystemToken({
      subjectActor: {
        id: self.actorId,
        slug: self.slug,
        type: ActorType.AGENT,
        displayName: self.name,
      },
      issuedByActor: {
        id: args.actor.id,
        slug: args.actor.slug,
        type: args.actor.type,
        displayName: args.actor.displayName,
      },
      scopes: [
        McpScopes.USE.id,
        ...ALL_TASKS_SCOPES.map((s) => s.id),
        ...ALL_CONTEXT_SCOPES.map((s) => s.id),
      ],
    });

    this.logger.debug(
      `Issued ephemeral access token for actor ${args.actor.id} with jti ${token.jti}`,
    );

    const events = backend.streamMessage({
      conversationId: args.conversationId,
      threadId: args.threadId,
      message: args.message,
      actor: args.actor,
      agentName: self.name,
      systemPrompt: self.systemPrompt,
      modelId: self.modelId,
      token: token.token,
    });

    return { agentActorId: self.actorId, events };
  }
}
