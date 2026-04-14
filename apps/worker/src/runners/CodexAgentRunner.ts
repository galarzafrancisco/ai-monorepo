import { on } from "events";
import { AgentModelConfig, AgentRunContext, RuntimeMcpServerConfig } from "./AgentRunner.js";
import { BaseAgentRunner } from "./BaseAgentRunner.js";
import { Codex } from "@openai/codex-sdk";

function makeMcpConfig(ctx: AgentRunContext): any {
  const config: any = {
    "codex_apps": {
      url: "http://localhost",
      enabled: false,
    }
  };
  if (!ctx.mcpServers) {
    return config;
  }
  for (const [name, serverConfig] of Object.entries(ctx.mcpServers)) {
    if (serverConfig.type === "http") {
      config[name] = {
        url: serverConfig.url,
        http_headers: serverConfig.headers,
      };
      if (ctx.accessToken) {
        config[name].http_headers = {
          ...config[name].http_headers,
          Authorization: `Bearer ${ctx.accessToken}`,
        };
      }
    } else if (serverConfig.type === "stdio") {
      config[name] = {
        command: serverConfig.command,
        args: serverConfig.args,
      };
    }
  }
  return config;
}

export class CodexAgentRunner extends BaseAgentRunner {
  readonly kind = 'codex';

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
    
    // Init client
    const mcpConfig = makeMcpConfig(ctx);
    console.log(mcpConfig);
    
    const codex = new Codex(
      {
        config: {
          mcp_servers: mcpConfig,
        },
      }
    );
    // Start a session
    const thread = codex.startThread({
      model: this.model,
      sandboxMode: "workspace-write",
      workingDirectory: ctx.cwd,
      skipGitRepoCheck: true, // we could check from the runner if the folder is a git repo and only skip if it is not, but for testing purposes we can just skip
      networkAccessEnabled: true,
      webSearchEnabled: true,
      webSearchMode: "live",
    });
    // Send the prompt
    const { events } = await thread.runStreamed(ctx.prompt);

    // React to respones
    for await (const event of events) {
      switch (event.type) {
        case "item.completed":
          switch (event.item.type) {
            case "agent_message":
              void emit(`@${ctx.agentSlug} ${event.item.text}`);
              break;
            case "command_execution":
              void emit(`@${ctx.agentSlug} 🔧 Running ${event.item.command}`);
              if (onToolCall) {
                await onToolCall(event.item.command);
              }
              break;
            case "file_change":
              void emit(`@${ctx.agentSlug} ✏️ editing file`);
              break;
            case "mcp_tool_call":
              void emit(`@${ctx.agentSlug} 🧰 calling MCP Tool ${event.item.server} ${event.item.tool}`);
              if (onToolCall) {
                await onToolCall(event.item.tool);
              }
              break;
            case "reasoning":
              void emit(`@${ctx.agentSlug} 🤔 ${event.item.text}`);
              break;
            case "todo_list":
              void emit(`@${ctx.agentSlug} 📝 Reading ${event.item.items.length} todo items`);
              break;
            case "web_search":
              void emit(`@${ctx.agentSlug} 🔍 Searching the web for "${event.item.query}"`);
              break;
            default:
              void emit(`@${ctx.agentSlug} ...`);
              break;
          }
          break;
        case "turn.completed":
          console.log("turn completed");
          console.log(` - input tokens: ${event.usage.input_tokens}`);
          console.log(` - output tokens: ${event.usage.output_tokens}`);
          void emit(`@${ctx.agentSlug} [done]`);
          break;
        case "turn.failed":
          console.log("turn failed", event.error);
          void emit(`@${ctx.agentSlug} [error]`);
          if (onError) {
            await onError({
              message: event.error.message,
              rawMessage: event.error,
            });
          }
          return "error";
        case "turn.started":
          void emit(`@${ctx.agentSlug} [turn started]`);
          break;
        case "item.started":
          void emit(`@${ctx.agentSlug} [item started]`);
          break;
        case "item.updated":
          void emit(`@${ctx.agentSlug} [item updated]`);
          break;
        case "thread.started":
          await setSession(event.thread_id);
          void emit(`@${ctx.agentSlug} [thread started] ${event.thread_id}`);
          break;
        case "error":
          console.log("thread error", event.message);
          void emit(`@${ctx.agentSlug} [error]`);
          if (onError) {
            await onError({
              message: event.message,
              rawMessage: event,
            });
          }
          return "error";
        default:
          console.log("event", event);
      }
    }

    return "done";
  }
}