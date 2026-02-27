import { forwardRef, Inject, Injectable, Logger } from "@nestjs/common";
import { IssuedAccessTokenService, IssueTokenResult } from "src/authorization-server/issued-access-token.service";
import { ThreadsService } from "./threads.service";
import { AgentsService } from "src/agents/agents.service";
import { AgentResult } from "src/agents/dto/service/agents.service.types";
import { Agent, MCPServer, MCPServerStreamableHttp, run, setDefaultOpenAIKey } from "@openai/agents";
import { OpenAI } from 'openai';
import { getConfig } from "src/config/env.config";
import { ActorType } from "src/identity-provider/enums";
import { McpScopes } from "src/auth/core/scopes/mcp.scopes";
import { ALL_TASKS_SCOPES } from "src/tasks/tasks.scopes";
import { ALL_CONTEXT_SCOPES } from "src/context/context.scopes";
import { ActorEntity } from "src/identity-provider/actor.entity";

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

class PrefixedMcpServer implements MCPServer {
  private readonly nameMap = new Map<string, string>();

  constructor(
    private readonly inner: MCPServer,
    private readonly prefix: string,
  ) { }

  get cacheToolsList(): boolean {
    return this.inner.cacheToolsList;
  }

  set cacheToolsList(value: boolean) {
    this.inner.cacheToolsList = value;
  }

  get toolFilter() {
    return this.inner.toolFilter;
  }

  set toolFilter(value: MCPServer["toolFilter"]) {
    this.inner.toolFilter = value;
  }

  get toolMetaResolver() {
    return this.inner.toolMetaResolver;
  }

  set toolMetaResolver(value: MCPServer["toolMetaResolver"]) {
    this.inner.toolMetaResolver = value;
  }

  get errorFunction() {
    return this.inner.errorFunction;
  }

  set errorFunction(value: MCPServer["errorFunction"]) {
    this.inner.errorFunction = value;
  }

  get name() {
    return this.inner.name;
  }

  async connect() {
    return this.inner.connect();
  }

  async close() {
    return this.inner.close();
  }

  async listTools() {
    const tools = await this.inner.listTools();
    this.nameMap.clear();

    return tools.map((tool) => {
      const prefixedName = `${this.prefix}__${tool.name}`;
      this.nameMap.set(prefixedName, tool.name);
      return {
        ...tool,
        name: prefixedName,
      };
    });
  }

  async callTool(
    toolName: string,
    args: Record<string, unknown> | null,
    meta?: Record<string, unknown> | null,
  ) {
    const originalName =
      this.nameMap.get(toolName) ?? toolName.replace(`${this.prefix}__`, "");

    return this.inner.callTool(originalName, args, meta);
  }

  async invalidateToolsCache() {
    this.nameMap.clear();
    return this.inner.invalidateToolsCache();
  }
}

async function makeMcpServers(token: IssueTokenResult): Promise<MCPServer[]> {
  const BASE_URL = getConfig().issuerUrl;

  const customFetch: typeof fetch = async (input: URL | RequestInfo, init: RequestInit = {}) => {
    const headers = new Headers(init.headers);

    headers.set("Authorization", `Bearer ${token.token}`);
    // headers.set("X-Taico-Actor", actorId);

    return fetch(input, { ...init, headers });
  };

  const tasks = new MCPServerStreamableHttp({
    name: 'tasks',
    url: `${BASE_URL}/api/v1/tasks/tasks/mcp`,
    requestInit: {
      headers: {
        Authorization: `Bearer ${token.token}`
      }
    },
    fetch: customFetch,
  });

  const context = new MCPServerStreamableHttp({
    name: 'context',
    url: `${BASE_URL}/api/v1/context/blocks/mcp`,
    requestInit: {
      headers: {
        Authorization: `Bearer ${token.token}`
      }
    },
    fetch: customFetch,
  });

  await Promise.all([
    tasks.connect(),
    context.connect(),
  ]);

  return [
    new PrefixedMcpServer(tasks, "tasks"),
    new PrefixedMcpServer(context, "context"),
  ];
}

@Injectable()
export class ChatService {

  private logger = new Logger(ChatService.name);

  constructor(
    private readonly agentsService: AgentsService,
    @Inject(forwardRef(() => ThreadsService))
    private readonly threadsService: ThreadsService,
    private readonly issuedAccessTokenService: IssuedAccessTokenService,
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
    const mcpServers = await makeMcpServers(token);
    const agent = new Agent({
      name: self.name,
      instructions: self.systemPrompt,
      model: self.modelId || 'gpt-5.2-codex',
      mcpServers: mcpServers,
    });
    this.logger.log(`Sending message sent to ${conversationId}`);

    const result = await run(agent, this.makeMessage({ message, actor }), {
      conversationId,
      stream: true,
    });

    for await (const event of result) {
      this.logger.log(`event type: ${event.type}`);
      // this.logger.log(event);
      if (event.type === "run_item_stream_event") {
        switch (event.item.type) {
          case "reasoning_item":
            console.log('Reasoning');
            this.threadsService.createMessage({
              threadId: threadId,
              content: `Thinking...`,
              createdByActorId: self.actorId,
            });
            console.log(event.item.toJSON());
            break;
          case "tool_call_item":
            console.log('Tool call');
            this.threadsService.createMessage({
              threadId: threadId,
              content: `🔨 Tool call`,
              createdByActorId: self.actorId,
            });
            console.log(event.item.toJSON());
            break;
          case "tool_call_output_item":
            console.log('Tool response');
            this.threadsService.createMessage({
              threadId: threadId,
              content: `🔨 Tool response`,
              createdByActorId: self.actorId,
            });
            break;
          case "message_output_item":
            console.log('Message');
            console.log(event.item.content);
            this.threadsService.createMessage({
              threadId: threadId,
              content: event.item.content,
              createdByActorId: self.actorId,
            });
            break;
          default:
            console.log(`type: ${event.item.type}`);
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
