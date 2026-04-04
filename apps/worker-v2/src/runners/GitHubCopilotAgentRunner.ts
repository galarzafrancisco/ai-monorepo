import { BaseAgentRunner } from "./BaseAgentRunner.js";
import { EXECUTION_ID_HEADER } from "../helpers/config.js";
import { AgentModelConfig, AgentRunContext } from "./AgentRunner.js";
import { approveAll, CopilotClient, MCPRemoteServerConfig } from "@github/copilot-sdk";

export class GitHubCopilotAgentRunner extends BaseAgentRunner {
  readonly kind = 'githubcopilot';
  private client: CopilotClient | null = null;
  private model: string;

  constructor(modelConfig: AgentModelConfig = {}) {
    super();
    this.model = modelConfig.modelId ?? 'gpt-5.2-codex';
  }

  protected async runInternal(
    ctx: AgentRunContext,
    emit: (msg: string) => Promise<void>,
    setSession: (id: string) => Promise<void>,
    onError?: (error: { message: string; rawMessage?: any }) => void | Promise<void>,
  ): Promise<string> {
    const agentLabel = ctx.agentSlug ? `@${ctx.agentSlug}` : 'Assistant';

    return new Promise(async (resolve, reject) => {
      try {
        // Init client
        this.client = new CopilotClient({
          cwd: ctx.cwd,
        });
        await this.client.start();

        const taskMcpServer: MCPRemoteServerConfig = {
          type: "http",
          url: `${ctx.baseUrl}/api/v1/tasks/tasks/mcp`,
          headers: {
            Authorization: `Bearer ${ctx.accessToken}`,
            [EXECUTION_ID_HEADER]: ctx.executionId,
          },
          tools: ["*"],
        };

        const contextMcpServer: MCPRemoteServerConfig = {
          type: "http",
          url: `${ctx.baseUrl}/api/v1/context/blocks/mcp`,
          headers: {
            Authorization: `Bearer ${ctx.accessToken}`,
            [EXECUTION_ID_HEADER]: ctx.executionId,
          },
          tools: ["*"],
        };

        // Create a session for this work
        const session = await this.client.createSession({
          model: this.model,
          onPermissionRequest: approveAll,
          mcpServers: {
            tasks: taskMcpServer,
            context: contextMcpServer,
          },
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
}
