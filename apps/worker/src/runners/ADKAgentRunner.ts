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
import { EXECUTION_ID_HEADER } from "../helpers/config.js";
import {
  AgentModelConfig,
  AgentRunContext,
  RuntimeMcpServerConfig,
} from "./AgentRunner.js";
import { randomUUID } from "node:crypto";
import { InterruptedExecutionError } from "../task-execution-errors.js";

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
    readonly serverName: string,
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
    onToolCall?: (toolName: string) => void | Promise<void>,
  ): Promise<string> {
    // Check if already aborted before creating any resources
    if (ctx.abortSignal?.aborted) {
      throw new InterruptedExecutionError('ADK agent execution was interrupted before start');
    }

    const formatter = new ADKMessageFormatter(ctx.agentSlug);

    let finalResult = '';

    // Init a session
    const session = await this.sessionService.createSession({
      appName: 'app-123',
      sessionId: `adk-${randomUUID()}`,
      userId: 'user-123',
    });
    await setSession(session.id);

    const mcpServers =
      ctx.mcpServers ?? {
        tasks: {
          type: 'http' as const,
          url: `${ctx.baseUrl}/api/v1/tasks/tasks/mcp`,
          headers: {
            Authorization: `Bearer ${ctx.accessToken}`,
            [EXECUTION_ID_HEADER]: ctx.executionId,
          },
        },
        context: {
          type: 'http' as const,
          url: `${ctx.baseUrl}/api/v1/context/blocks/mcp`,
          headers: {
            Authorization: `Bearer ${ctx.accessToken}`,
            [EXECUTION_ID_HEADER]: ctx.executionId,
          },
        },
      };
    const toolsets = Object.entries(mcpServers).map(([serverName, serverConfig]) =>
      new NamespacedMCPToolset(
        this.toConnectionParams(serverConfig),
        serverName,
      ),
    );

    try {
      await this.preflightToolsets(toolsets, mcpServers);

      const agent = new LlmAgent({
        name: 'agent',
        model: this.modelId,
        description: '',
        instruction: '',
        tools: toolsets,
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

      // Set up abort signal handler if provided
      // Note: ADK doesn't have native abort support, so we'll break out of the loop
      let aborted = false;
      if (ctx.abortSignal) {
        ctx.abortSignal.addEventListener('abort', () => {
          console.log('[ADKAgentRunner] Abort signal received, will stop processing');
          aborted = true;
        });
      }

      for await (const msg of stream) {
        if (aborted) {
          console.log('[ADKAgentRunner] Breaking out of message loop due to abort');
          break;
        }

        if (msg.content?.parts) {
          for (const part of msg.content.parts) {
            if (part.functionCall?.name) {
              await onToolCall?.(part.functionCall.name);
            }
          }
        }

        // map → string
        const messages = formatter.format(msg);
        messages.forEach(async (message) => {
          await emit(message);
        });
      }

      // If we were aborted, throw an error instead of returning success
      if (aborted) {
        throw new InterruptedExecutionError('ADK agent execution was interrupted');
      }

      return finalResult;
    } finally {
      // Always close toolsets, even if we were interrupted or errored
      await Promise.all(toolsets.map((toolset) => toolset.close()));
    }
  }

  private toConnectionParams(serverConfig: RuntimeMcpServerConfig) {
    if (serverConfig.type === 'http') {
      return {
        type: 'StreamableHTTPConnectionParams' as const,
        url: serverConfig.url,
        header: serverConfig.headers,
      };
    }

    return {
      type: 'StdioConnectionParams' as const,
      serverParams: {
        command: serverConfig.command,
        args: serverConfig.args,
      },
    };
  }

  private async preflightToolsets(
    toolsets: NamespacedMCPToolset[],
    mcpServers: Record<string, RuntimeMcpServerConfig>,
  ): Promise<void> {
    for (const toolset of toolsets) {
      try {
        await toolset.getTools();
      } catch (error) {
        const serverConfig = mcpServers[toolset.serverName];
        throw new Error(
          this.formatMcpConnectionError(toolset.serverName, serverConfig, error),
          { cause: error },
        );
      }
    }
  }

  private formatMcpConnectionError(
    serverName: string,
    serverConfig: RuntimeMcpServerConfig,
    error: unknown,
  ): string {
    const details = this.collectErrorDetails(error);
    const location =
      serverConfig.type === 'http'
        ? serverConfig.url
        : `${serverConfig.command} ${serverConfig.args.join(' ')}`.trim();
    const protocol = serverConfig.type === 'http' ? 'HTTP' : 'stdio';
    const suffix = details.length > 0 ? `: ${details.join(' | ')}` : '';

    return `Failed to connect to MCP server "${serverName}" via ${protocol} (${location})${suffix}`;
  }

  private collectErrorDetails(error: unknown): string[] {
    const details: string[] = [];
    const seen = new Set<unknown>();

    let current: unknown = error;
    while (current && typeof current === 'object' && !seen.has(current)) {
      seen.add(current);

      if ('message' in current && typeof current.message === 'string') {
        details.push(current.message);
      }

      if ('code' in current && typeof current.code === 'string') {
        details.push(`code=${current.code}`);
      }

      current = 'cause' in current ? current.cause : undefined;
    }

    if (details.length === 0 && error instanceof Error) {
      details.push(error.message);
    }

    return [...new Set(details)];
  }
}
