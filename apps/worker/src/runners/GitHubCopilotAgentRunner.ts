import { BaseAgentRunner } from "./BaseAgentRunner.js";
import { EXECUTION_ID_HEADER } from "../helpers/config.js";
import {
  AgentModelConfig,
  AgentRunContext,
  RuntimeMcpServerConfig,
} from "./AgentRunner.js";
import { approveAll, CopilotClient, MCPRemoteServerConfig, MCPLocalServerConfig } from "@github/copilot-sdk";

export class GitHubCopilotAgentRunner extends BaseAgentRunner {
  readonly kind = 'githubcopilot';
  private client: CopilotClient | null = null;
  private model: string;

  constructor(modelConfig: AgentModelConfig = {}) {
    super();
    this.model = modelConfig.modelId ?? 'gpt-5.3-codex';
  }

  protected async runInternal(
    ctx: AgentRunContext,
    emit: (msg: string) => Promise<void>,
    setSession: (id: string) => Promise<void>,
    onError?: (error: { message: string; rawMessage?: any }) => void | Promise<void>,
    onToolCall?: (toolName: string) => void | Promise<void>,
  ): Promise<string> {
    const agentLabel = ctx.agentSlug ? `@${ctx.agentSlug}` : 'Assistant';

    return new Promise(async (resolve, reject) => {
      try {
        // Init client
        this.client = new CopilotClient({
          cwd: ctx.cwd,
        });
        await this.client.start();

        const mcpServers = this.buildMcpServers(ctx);

        // Create a session for this work
        const session = await this.client.createSession({
          model: this.model,
          onPermissionRequest: approveAll,
          mcpServers,
        });

        if (session?.sessionId) {
          await setSession(session.sessionId);
        }

        console.log(`created session ${session.sessionId} in ${session.workspacePath}`);

        let lastAssistantMessage = '';

        // Subscribe to events
        session.on('session.idle', async () => {
          console.log('session.idle');
          if (this.client) {
            await this.client.stop();
          }
          resolve(lastAssistantMessage);
        });
        session.on('assistant.reasoning', (reasoning) => {
          void emit(`💬 ${agentLabel} Thinking... ${reasoning.data.content}`);
        });
        session.on('assistant.message', (message) => {
          lastAssistantMessage = message.data.content ?? '';
          void emit(`💬 ${agentLabel}: ${message.data.content}`);
        });
        session.on('tool.execution_start', (toolCall) => {
          void onToolCall?.(toolCall.data.toolName);
          void emit(`🔧 ${agentLabel} Tool call: ${toolCall.data.toolName}`);
        });
        session.on('tool.execution_complete', () => {
          void emit(`🔧 ${agentLabel} Tool response`);
        });

        // Fire up the prompt
        await session.send({
          prompt: ctx.prompt,
        });
      } catch (err: any) {
        if (this.client) {
          await this.client.stop();
        }
        if (onError) {
          await onError({
            message: err?.message ?? String(err),
            rawMessage: err,
          });
        }
        reject(err);
      }
    });
  }

  private buildMcpServers(
    ctx: AgentRunContext,
  ): Record<string, MCPRemoteServerConfig | MCPLocalServerConfig> {
    const runtimeMcpServers =
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

    return Object.fromEntries(
      Object.entries(runtimeMcpServers).map(([serverName, serverConfig]) => [
        serverName,
        this.toCopilotMcpServerConfig(serverConfig),
      ]),
    );
  }

  private toCopilotMcpServerConfig(
    serverConfig: RuntimeMcpServerConfig,
  ): MCPRemoteServerConfig | MCPLocalServerConfig {
    if (serverConfig.type === 'http') {
      return {
        type: "http",
        url: serverConfig.url,
        headers: serverConfig.headers,
        tools: ["*"],
      };
    }

    return {
      type: "local",
      command: serverConfig.command,
      args: serverConfig.args,
      tools: ["*"],
    };
  }
}
