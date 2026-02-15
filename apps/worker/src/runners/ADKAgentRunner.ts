// ADKAgentRunner.ts
import { BaseAgentRunner } from "./BaseAgentRunner.js";
import {
  LlmAgent,
  Runner,
  InMemorySessionService,
  MCPToolset,
  BaseTool,
} from "@google/adk";
import { ADKMessageFormatter } from "../formatters/ADKMessageFormatter.js";
import { ACCESS_TOKEN, BASE_URL, RUN_ID_HEADER } from "../helpers/config.js";
import { AgentModelConfig, AgentRunContext } from "./AgentRunner.js";

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

export class ADKAgentRunner extends BaseAgentRunner {
  readonly kind = 'adk';

  private formatter = new ADKMessageFormatter();
  private modelId: string;

  private sessionService = new InMemorySessionService();

  constructor(modelConfig: AgentModelConfig = {}) {
    super();
    this.modelId = modelConfig.modelId ?? 'gemini-2.5-flash';
  }
  
  protected async runInternal(
    ctx: AgentRunContext,
    emit: (msg: string) => Promise<void>,
    setSession: (id: string) => Promise<void>,
    onError?: (error: { message: string; rawMessage?: any }) => void | Promise<void>,
  ): Promise<string> {
    
    let finalResult = '';

    // Init a session
    const session = await this.sessionService.createSession({
      appName: 'app-123',
      sessionId: 'session-123',
      userId: 'user-123',
    });

    const agent = new LlmAgent({
      name: 'agent',
      model: this.modelId,
      description: '',
      instruction: '',
      tools: [
        new NamespacedMCPToolset({
          type: 'StreamableHTTPConnectionParams',
          url: `${BASE_URL}/api/v1/tasks/tasks/mcp`,
          header: {
            Authorization: `Bearer ${ACCESS_TOKEN}`,
            [RUN_ID_HEADER]: ctx.runId,
          },
        }, 'tasks'),
        new NamespacedMCPToolset({
          type: 'StreamableHTTPConnectionParams',
          url: `${BASE_URL}/api/v1/context/blocks/mcp`,
          header: {
            Authorization: `Bearer ${ACCESS_TOKEN}`,
            [RUN_ID_HEADER]: ctx.runId,
          },
        }, 'context')
      ]
    });

    const runner = new Runner({
      appName: 'app-123',
      agent: agent,
      sessionService: this.sessionService,
    });

    const stream = runner.runAsync({
      userId: session.userId,
      sessionId: session.id,
      newMessage: {
        parts: [
          {
            text: ctx.prompt,
          }
        ],
        role: 'user',
      }
    });

    for await (const msg of stream) {
      // map → string
      const messages = this.formatter.format(msg);
      messages.forEach(async (message) => {
        await emit(message);
      });
    }

    return finalResult;
  }
}
