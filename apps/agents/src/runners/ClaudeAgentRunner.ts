// ClaudeAgentRunner.ts
import { BaseAgentRunner } from "./BaseAgentRunner.js";
import { query } from "@anthropic-ai/claude-agent-sdk";
import { ClaudeMessageFormatter } from "../formatters/ClaudeMessageFormatter.js";
import { ACCESS_TOKEN, BASE_URL } from "src/helpers/config.js";

export class ClaudeAgentRunner extends BaseAgentRunner {
  readonly kind = 'claude';

  private formatter = new ClaudeMessageFormatter();

  protected async runInternal(
    ctx,
    emit,
    setSession,
    onError?
  ): Promise<string> {

    let finalResult = '';
    const stream = query({
      prompt: ctx.prompt,
      options: {
        cwd: ctx.cwd,
        // resume: ctx.resume,
        persistSession: true,
        settingSources: ['user', 'project', 'local'],
        ...(ctx.options ?? {}),
        mcpServers: {
          tasks: {
            type: "http",
            url: `${BASE_URL}/api/v1/tasks/tasks/mcp`,
            headers: {
              Authorization: `Bearer ${ACCESS_TOKEN}`
            },
          }
        }
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

      // map → string
      const text = this.formatter.format(msg);
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
