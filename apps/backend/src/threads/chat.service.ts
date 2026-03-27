import {
  forwardRef,
  Inject,
  Injectable,
  Logger,
  OnModuleDestroy,
} from "@nestjs/common";
import { IssuedAccessTokenService } from "src/authorization-server/issued-access-token.service";
import { ThreadsService } from "./threads.service";
import { AgentsService } from "src/agents/agents.service";
import { AgentResult } from "src/agents/dto/service/agents.service.types";
import {
  Agent,
  OpenAIProvider,
  Runner as OpenAIRunner,
  run,
  setDefaultOpenAIClient,
  setDefaultOpenAIKey,
} from "@openai/agents";
import { OpenAI } from "openai";
import { randomUUID } from "crypto";
import { getConfig } from "src/config/env.config";
import { ActorType } from "src/identity-provider/enums";
import { McpScopes } from "src/auth/core/scopes/mcp.scopes";
import { ALL_TASKS_SCOPES } from "src/tasks/tasks.scopes";
import { ALL_CONTEXT_SCOPES } from "src/context/context.scopes";
import { ActorEntity } from "src/identity-provider/actor.entity";
import { OpenAiMcpServerFactoryService } from "./openai-mcp-server-factory.service";
import { AgentType } from "src/agents/enums";
import { BaseTool, Event, LlmAgent, MCPToolset, Runner } from "@google/adk";
import { SqliteSessionService } from "@taico/adk-session-store";
import { basename, dirname, extname, join } from "node:path";
import { ChatProvidersService } from "src/chat-providers/chat-providers.service";

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

type RunStreamEvent = Awaited<ReturnType<typeof run>> extends AsyncIterable<infer T>
  ? T
  : never;

@Injectable()
export class ChatService implements OnModuleDestroy {

  private logger = new Logger(ChatService.name);

  private readonly adkSessionService: SqliteSessionService;

  constructor(
    private readonly agentsService: AgentsService,
    @Inject(forwardRef(() => ThreadsService))
    private readonly threadsService: ThreadsService,
    private readonly issuedAccessTokenService: IssuedAccessTokenService,
    private readonly openAiMcpServerFactoryService: OpenAiMcpServerFactoryService,
    private readonly chatProvidersService: ChatProvidersService,
  ) {
    this.adkSessionService = new SqliteSessionService({
      filename: this.getChatDatabasePath(getConfig().databasePath),
    });
  }

  public async onModuleDestroy(): Promise<void> {
    try {
      await this.adkSessionService.close();
    } catch (error) {
      this.logger.warn({
        message: "Failed to close ADK session store",
        error:
          error instanceof Error
            ? { message: error.message, stack: error.stack, name: error.name }
            : String(error),
      });
    }
  }

  private async getSelf(): Promise<AgentResult> {
    const self = this.agentsService.getAgentBySlug({ slug: 'taico' });
    return self;
  }

  private async getOpenAiApiKey(): Promise<string> {
    const config = await this.chatProvidersService.getActiveChatProviderConfig();
    return config.apiKey;
  }

  private configureOpenAiSdk(apiKey: string): OpenAIProvider {
    const client = new OpenAI({ apiKey });

    // Keep the SDK globals in sync for any code path that still reads defaults.
    setDefaultOpenAIClient(client);
    setDefaultOpenAIKey(apiKey);

    return new OpenAIProvider({ openAIClient: client });
  }

  public async ensureConversationAvailable(): Promise<void> {
    const self = await this.getSelf();

    if (self.type === AgentType.ADK) {
      return;
    }

    await this.getOpenAiApiKey();
  }

  private getChatDatabasePath(databasePath: string): string {
    if (databasePath === ":memory:") {
      return databasePath;
    }

    const extension = extname(databasePath);
    if (!extension) {
      return `${databasePath}-chat`;
    }

    const filename = basename(databasePath, extension);
    return join(dirname(databasePath), `${filename}-chat${extension}`);
  }

  public async createConversation({ threadId }: CreateConversationArgs) {
    const self = await this.getSelf();

    if (self.type === AgentType.ADK) {
      const session = await this.adkSessionService.createSession({
        appName: "taico-chat",
        sessionId: randomUUID(),
        userId: threadId,
      });

      return {
        id: session.id,
      };
    }

    try {
      const apiKey = await this.getOpenAiApiKey();
      const client = new OpenAI({
        apiKey,
      });
      const conversation = await client.conversations.create({
        metadata: {
          threadId
        }
      });
      return conversation;
    } catch (error) {
      this.logger.error({
        message: 'Failed to create OpenAI conversation',
        threadId,
        error: error instanceof Error
          ? { message: error.message, stack: error.stack, name: error.name }
          : String(error),
      });
      throw error;
    }
  }

  private makeMessage({ message, actor }: MakeMessageArgs) {
    return `[${actor.displayName} @${actor.slug}] says:\n${message}`;
  }

  private parseResponseTextDelta(event: RunStreamEvent): string | null {
    if (event.type !== 'raw_model_stream_event') {
      return null;
    }

    if (event.data.type !== 'output_text_delta') {
      return null;
    }

    return event.data.delta;
  }

  private buildThreadScopedInstructions(
    baseInstructions: string,
    threadId: string,
    options?: { useNamespacedToolNames?: boolean },
  ): string {
    const tasksPrefix = options?.useNamespacedToolNames ? "mcp__tasks__" : "tasks__";
    const contextPrefix = options?.useNamespacedToolNames ? "mcp__context__" : "context__";

    return `${baseInstructions}

Thread context:
- You are working inside thread ${threadId}.
- This thread coordinates multiple tasks working toward a shared goal.
- Keep your guidance and execution aligned with thread-level context, not just one task.

Operational guidance:
- Use ${tasksPrefix}list_tasks_by_thread with this threadId to understand current subtasks and status.
- Use ${contextPrefix}get_thread_state_memory with this threadId to read current shared state memory.
- When a task or context block becomes relevant to the thread, attach it using ${tasksPrefix}attach_task_to_thread or ${contextPrefix}attach_block_to_thread.
- If a task/block was attached by mistake or is no longer relevant, remove it using ${tasksPrefix}detach_task_from_thread or ${contextPrefix}detach_block_from_thread.
- During conversation, when you discover durable cross-task decisions/constraints/risks, update memory via ${contextPrefix}update_block.
- If the user asks for updates on a given task, read the task and the memory block to update the user.
- Only write durable shared memory (not ephemeral chat details).`;
  }

  private async createAdkRunner(
    token: string,
    modelId: string,
    instructions: string,
  ): Promise<Runner> {
    const baseUrl = getConfig().issuerUrl;

    const agent = new LlmAgent({
      name: "taico",
      model: modelId,
      description: "",
      instruction: instructions,
      tools: [
        new NamespacedMCPToolset(
          {
            type: "StreamableHTTPConnectionParams",
            url: `${baseUrl}/api/v1/tasks/tasks/mcp`,
            header: {
              Authorization: `Bearer ${token}`,
            },
          },
          "tasks",
        ),
        new NamespacedMCPToolset(
          {
            type: "StreamableHTTPConnectionParams",
            url: `${baseUrl}/api/v1/context/blocks/mcp`,
            header: {
              Authorization: `Bearer ${token}`,
            },
          },
          "context",
        ),
      ],
    });

    return new Runner({
      appName: "taico-chat",
      agent,
      sessionService: this.adkSessionService,
    });
  }

  private parseAdkTextParts(event: Event): string[] {
    if (!event.content?.parts) {
      return [];
    }

    return event.content.parts
      .map((part) => part.text)
      .filter((text): text is string => typeof text === "string" && text.length > 0);
  }

  private emitAdkActivity(event: Event, threadId: string, actorId: string): void {
    if (!event.content?.parts) {
      return;
    }

    for (const part of event.content.parts) {
      if (part.thought) {
        this.threadsService.emitAgentActivity({
          threadId,
          actorId,
          kind: "thinking",
        });
      }

      if (part.functionCall || part.functionResponse) {
        this.threadsService.emitAgentActivity({
          threadId,
          actorId,
          kind: "tool_calling",
        });
      }
    }
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

    const token = await this.issuedAccessTokenService.issueSystemToken({
      subjectActor: selfActor,
      issuedByActor: chatActor,
      scopes: [
        McpScopes.USE.id,
        ...ALL_TASKS_SCOPES.map(scope => scope.id),
        ...ALL_CONTEXT_SCOPES.map(scope => scope.id),
      ],
    });
    this.logger.debug(`Issued ephemeral access token for actor ${actor.id} with jti ${token.jti}`);

    if (self.type === AgentType.ADK) {
      try {
        const instructions = this.buildThreadScopedInstructions(self.systemPrompt, threadId, {
          useNamespacedToolNames: true,
        });
        const runner = await this.createAdkRunner(
          token.token,
          self.modelId || "gemini-2.5-flash",
          instructions,
        );
        const stream = runner.runAsync({
          userId: threadId,
          sessionId: conversationId,
          newMessage: {
            role: "user",
            parts: [
              {
                text: this.makeMessage({ message, actor }),
              },
            ],
          },
        });

        const responseStreamId = randomUUID();
        const finalChunks: string[] = [];
        let sawPartial = false;

        for await (const event of stream) {
          this.emitAdkActivity(event, threadId, self.actorId);

          const textParts = this.parseAdkTextParts(event);
          if (textParts.length === 0) {
            continue;
          }

          const chunk = textParts.join("");

          if (event.partial) {
            sawPartial = true;
            finalChunks.push(chunk);
            this.threadsService.emitAgentResponseDelta({
              threadId,
              actorId: self.actorId,
              streamId: responseStreamId,
              delta: chunk,
            });
            continue;
          }

          if (!sawPartial) {
            finalChunks.push(chunk);
            this.threadsService.emitAgentResponseDelta({
              threadId,
              actorId: self.actorId,
              streamId: responseStreamId,
              delta: chunk,
            });
          }
        }

        const finalMessage = finalChunks.join("").trim();

        if (finalMessage) {
          await this.threadsService.createMessage({
            threadId,
            content: finalMessage,
            createdByActorId: self.actorId,
          });
        }
      } catch (error) {
        this.logger.error({
          message: "ADK agent run failed",
          threadId,
          conversationId,
          error:
            error instanceof Error
              ? { message: error.message, stack: error.stack, name: error.name }
              : String(error),
        });

        const errorMessage =
          error instanceof Error
            ? `I encountered an error while processing your message: ${error.message}`
            : "I encountered an unexpected error while processing your message.";

        try {
          await this.threadsService.createMessage({
            threadId,
            content: errorMessage,
            createdByActorId: self.actorId,
          });
        } catch (messageError) {
          this.logger.error({
            message: "Failed to create ADK error message in thread",
            threadId,
            error:
              messageError instanceof Error
                ? {
                    message: messageError.message,
                    stack: messageError.stack,
                    name: messageError.name,
                  }
                : String(messageError),
          });
        }
      }

      return;
    }

    // Make agent
    const apiKey = await this.getOpenAiApiKey();
    const modelProvider = this.configureOpenAiSdk(apiKey);
    const mcpServers = await this.openAiMcpServerFactoryService.createServers(token);
    const agent = new Agent({
      name: self.name,
      instructions: this.buildThreadScopedInstructions(self.systemPrompt, threadId),
      model: self.modelId || 'gpt-5.2-codex',
      mcpServers: mcpServers,
    });
    const runner = new OpenAIRunner({ modelProvider });
    this.logger.log(`Sending message sent to ${conversationId}`);

    try {
      const result = await runner.run(agent, this.makeMessage({ message, actor }), {
        conversationId,
        stream: true,
      });
      const responseStreamId = randomUUID();

      for await (const event of result) {
        const textDelta = this.parseResponseTextDelta(event);
        if (textDelta) {
          this.threadsService.emitAgentResponseDelta({
            threadId,
            actorId: self.actorId,
            streamId: responseStreamId,
            delta: textDelta,
          });
        }

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
    } catch (error) {
      this.logger.error({
        message: 'OpenAI agent run failed',
        threadId,
        conversationId,
        error: error instanceof Error
          ? { message: error.message, stack: error.stack, name: error.name }
          : String(error),
      });

      // Send an error message to the thread so users know something went wrong
      const errorMessage = error instanceof Error
        ? `I encountered an error while processing your message: ${error.message}`
        : 'I encountered an unexpected error while processing your message.';

      try {
        await this.threadsService.createMessage({
          threadId: threadId,
          content: errorMessage,
          createdByActorId: self.actorId,
        });
      } catch (messageError) {
        this.logger.error({
          message: 'Failed to create error message in thread',
          threadId,
          error: messageError instanceof Error
            ? { message: messageError.message, stack: messageError.stack, name: messageError.name }
            : String(messageError),
        });
      }

      // Do not re-throw - error has been handled by logging and sending user-facing message
      // This prevents unhandled promise rejection crashes
    }

    return;
  }

}

class NamespacedTool extends BaseTool {
  constructor(
    private readonly wrappedTool: BaseTool,
    private readonly namespacedName: string,
  ) {
    super({
      name: namespacedName,
      description: wrappedTool.description,
      isLongRunning: wrappedTool.isLongRunning,
    });
  }

  override _getDeclaration() {
    const declaration = this.wrappedTool._getDeclaration();

    if (!declaration) {
      return declaration;
    }

    return {
      ...declaration,
      name: this.namespacedName,
    };
  }

  override async runAsync(request: Parameters<BaseTool["runAsync"]>[0]) {
    return this.wrappedTool.runAsync(request);
  }
}

class NamespacedMCPToolset extends MCPToolset {
  constructor(
    connectionParams: ConstructorParameters<typeof MCPToolset>[0],
    private readonly serverName: string,
  ) {
    super(connectionParams);
  }

  override async getTools(context?: Parameters<MCPToolset["getTools"]>[0]) {
    const tools = await super.getTools(context);
    return tools.map(
      (tool) =>
        new NamespacedTool(
          tool,
          `mcp__${this.serverName}__${tool.name}`,
        ),
    );
  }
}
