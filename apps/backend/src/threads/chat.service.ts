import { forwardRef, Inject, Injectable, Logger } from "@nestjs/common";
import { IssuedAccessTokenService } from "src/authorization-server/issued-access-token.service";
import { ThreadsService } from "./threads.service";
import { AgentsService } from "src/agents/agents.service";
import { AgentResult } from "src/agents/dto/service/agents.service.types";
import { Agent, run, setDefaultOpenAIKey } from "@openai/agents";
import { OpenAI } from "openai";
import { getConfig } from "src/config/env.config";
import { ActorType } from "src/identity-provider/enums";
import { McpScopes } from "src/auth/core/scopes/mcp.scopes";
import { ALL_TASKS_SCOPES } from "src/tasks/tasks.scopes";
import { ALL_CONTEXT_SCOPES } from "src/context/context.scopes";
import { ActorEntity } from "src/identity-provider/actor.entity";
import { OpenAiMcpServerFactoryService } from "./openai-mcp-server-factory.service";

export interface CreateConversationArgs {
  threadId: string;
}

export interface MakeMessageArgs {
  message: string;
  actor: ActorEntity;
}

export interface SendMessageToThreadArgs {
  conversationId: string;
  threadId: string;
  message: string;
  actor: ActorEntity;
}

@Injectable()
export class ChatService {

  private logger = new Logger(ChatService.name);

  constructor(
    private readonly agentsService: AgentsService,
    @Inject(forwardRef(() => ThreadsService))
    private readonly threadsService: ThreadsService,
    private readonly issuedAccessTokenService: IssuedAccessTokenService,
    private readonly openAiMcpServerFactoryService: OpenAiMcpServerFactoryService,
  ) {
    // I absolutely hate this, but it's the only way to provide a key to the @openai/agents sdk
    setDefaultOpenAIKey(getConfig().openAiKey);
  }

  private async getSelf(): Promise<AgentResult> {
    const self = this.agentsService.getAgentBySlug({ slug: 'taico' });
    return self;
  }

  public async createConversation({ threadId }: CreateConversationArgs) {
    const client = new OpenAI({
      apiKey: getConfig().openAiKey,
    });
    const conversation = await client.conversations.create({
      metadata: {
        threadId
      }
    });
    return conversation;
  }

  // private async getConversation({ conversationId }: { conversationId: string }) {
  //   const client = new OpenAI({
  //     apiKey: getConfig().openAiKey,
  //   });
  //   const conversation = await client.conversations.retrieve(conversationId);
  //   return conversation;
  // }

  private makeMessage({ message, actor }: MakeMessageArgs) {
    return `[${actor.displayName} @${actor.slug}] says:\n${message}`;
  }

  private buildThreadScopedInstructions(baseInstructions: string, threadId: string): string {
    return `${baseInstructions}

Thread context:
- You are working inside thread ${threadId}.
- This thread coordinates multiple tasks working toward a shared goal.
- Keep your guidance and execution aligned with thread-level context, not just one task.

Operational guidance:
- Use tasks__list_tasks_by_thread with this threadId to understand current subtasks and status.
- Use context__get_thread_state_memory with this threadId to read current shared state memory.
- When a task or context block becomes relevant to the thread, attach it using tasks__attach_task_to_thread or context__attach_block_to_thread.
- If a task/block was attached by mistake or is no longer relevant, remove it using tasks__detach_task_from_thread or context__detach_block_from_thread.
- During conversation, when you discover durable cross-task decisions/constraints/risks, update memory via context__update_block.
- Only write durable shared memory (not ephemeral chat details).`;
  }

  public async sendMessageToThread({ conversationId, threadId, message, actor }: SendMessageToThreadArgs) {
    // Get self
    const self = await this.getSelf();

    if (actor.id === self.actorId) {
      this.logger.debug(`Actor ${actor.id} is the same as the agent itself. Skipping message send to avoid loops.`);
      return;
    }

    // Make token
    this.logger.debug(`Generating access token for actor ${actor.id} to use in MCP servers`);
    const selfActor = {
      id: self.actorId,
      slug: self.slug,
      type: ActorType.AGENT,
      displayName: self.name,
    };
    const chatActor = {
      id: actor.id,
      slug: actor.slug,
      type: actor.type,
      displayName: actor.displayName,
    }

    const token = await this.issuedAccessTokenService.issueToken({
      subjectActor: selfActor,
      issuedByActor: chatActor,
      name: `thread ${threadId} - ${new Date().toISOString()}`,
      scopes: [
        McpScopes.USE.id,
        ...ALL_TASKS_SCOPES.map(scope => scope.id),
        ...ALL_CONTEXT_SCOPES.map(scope => scope.id),
      ],
      expirationDays: 1, // kill it after 1 day max
    });
    this.logger.debug(`Issued access token for actor ${actor.id} with id ${token.entity.id}`);

    // Make agent
    const mcpServers = await this.openAiMcpServerFactoryService.createServers(token);
    const agent = new Agent({
      name: self.name,
      instructions: this.buildThreadScopedInstructions(self.systemPrompt, threadId),
      model: self.modelId || 'gpt-5.2-codex',
      mcpServers: mcpServers,
    });
    this.logger.log(`Sending message sent to ${conversationId}`);

    const result = await run(agent, this.makeMessage({ message, actor }), {
      conversationId,
      stream: true,
    });

    for await (const event of result) {
      if (event.type === "run_item_stream_event") {
        switch (event.item.type) {
          case "reasoning_item":
            this.threadsService.emitAgentActivity({
              threadId,
              actorId: self.actorId,
              kind: 'thinking',
            });
            break;
          case "tool_call_item":
            this.threadsService.emitAgentActivity({
              threadId,
              actorId: self.actorId,
              kind: 'tool_calling',
            });
            break;
          case "tool_call_output_item":
            break;
          case "message_output_item":
            this.threadsService.createMessage({
              threadId: threadId,
              content: event.item.content,
              createdByActorId: self.actorId,
            });
            break;
        }
      }
    }

    this.issuedAccessTokenService.revokeTokenById(token.entity.id)
      .catch(err => {
        this.logger.error(`Failed to revoke token for thread ${threadId} - token id ${token.entity.id}: ${err}`)
      })
    return;
  }

}
