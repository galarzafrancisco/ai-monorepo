// ClaudeAgentRunner.ts
import { BaseAgentRunner } from "./BaseAgentRunner.js";
import { query } from "@anthropic-ai/claude-agent-sdk";
import { ClaudeMessageFormatter } from "../formatters/ClaudeMessageFormatter.js";
import { EXECUTION_ID_HEADER } from "../helpers/config.js";
import { AgentModelConfig, AgentRunContext } from "./AgentRunner.js";
import { DEFAULT_AGENT_ALLOWED_TOOLS } from '@taico/shared';

export class ClaudeAgentRunner extends BaseAgentRunner {
  readonly kind = 'claude';

  constructor(_modelConfig: AgentModelConfig = {}) {
    super();
  }

  protected async runInternal(
    ctx: AgentRunContext,
    emit: (msg: string) => Promise<void>,
    setSession: (id: string) => Promise<void>,
    onError?: (error: { message: string; rawMessage?: any }) => void | Promise<void>,
    onToolCall?: (toolName: string) => void | Promise<void>,
  ): Promise<string> {
    const formatter = new ClaudeMessageFormatter(ctx.agentSlug);

    let finalResult = '';
    const mcpServers =
      ctx.mcpServers ?? {
        tasks: {
          type: 'http',
          url: `${ctx.baseUrl}/api/v1/tasks/tasks/mcp`,
          headers: {
            Authorization: `Bearer ${ctx.accessToken}`,
            [EXECUTION_ID_HEADER]: ctx.executionId,
          },
        },
        context: {
          type: 'http',
          url: `${ctx.baseUrl}/api/v1/context/blocks/mcp`,
          headers: {
            Authorization: `Bearer ${ctx.accessToken}`,
            [EXECUTION_ID_HEADER]: ctx.executionId,
          },
        },
      };

    const stream = query({
      prompt: ctx.prompt,
      options: {
        cwd: ctx.cwd,
        // resume: ctx.resume,
        persistSession: true,
        settingSources: ['user', 'project', 'local'],
        ...(ctx.options ?? {}),
        mcpServers,
        allowedTools: ctx.allowedTools ?? [...DEFAULT_AGENT_ALLOWED_TOOLS],
      },
    });

    for await (const msg of stream) {
      // session capture
      if (
        msg?.type === 'system' &&
        msg?.subtype === 'init' &&
        typeof msg.session_id === 'string'
      ) {
        await setSession(msg.session_id);
      }

      const toolCalls = formatter.extractToolCallNames(msg);
      for (const toolName of toolCalls) {
        await onToolCall?.(toolName);
      }

      // map → string
      const text = formatter.format(msg);
      if (text) await emit(text);

      if (msg.type === 'result' && msg.subtype === 'success') {
        // Check if this is an error result (e.g., quota limit)
        if (msg.is_error === true) {
          if (onError) {
            await onError({
              message: typeof msg.result === 'string' ? msg.result : 'Unknown error',
              rawMessage: msg,
            });
          }
        }
        finalResult = msg.result;
      }
    }

    return finalResult;
  }
}
