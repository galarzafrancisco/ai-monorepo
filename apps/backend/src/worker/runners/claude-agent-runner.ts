import { query } from '@anthropic-ai/claude-agent-sdk';
import { EXECUTION_ID_HEADER } from '../../auth/guards/constants/headers.constants';
import { ClaudeMessageFormatter } from '../formatters/claude-message-formatter';
import { BaseAgentRunner } from './base-agent-runner';
import { AgentRunContext } from './agent-runner.types';
import { DEFAULT_AGENT_ALLOWED_TOOLS } from '@taico/shared';

export class ClaudeAgentRunner extends BaseAgentRunner {
  readonly kind = 'claude';

  protected async runInternal(
    ctx: AgentRunContext,
    emit: (msg: string) => Promise<void>,
    setSession: (id: string) => Promise<void>,
    onError?: (error: { message: string; rawMessage?: unknown }) => void | Promise<void>,
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
        resume: ctx.resume,
        persistSession: true,
        settingSources: ['user', 'project', 'local'],
        ...(ctx.options ?? {}),
        mcpServers,
        allowedTools: ctx.allowedTools ?? [...DEFAULT_AGENT_ALLOWED_TOOLS],
      },
    });

    for await (const message of stream) {
      if (
        message?.type === 'system' &&
        message?.subtype === 'init' &&
        typeof message.session_id === 'string'
      ) {
        await setSession(message.session_id);
      }

      const text = formatter.format(message);
      if (text) {
        await emit(text);
      }

      if (message.type === 'result' && message.subtype === 'success') {
        if (message.is_error === true) {
          await onError?.({
            message:
              typeof message.result === 'string'
                ? message.result
                : 'Unknown Claude error result',
            rawMessage: message,
          });
        }
        finalResult =
          typeof message.result === 'string'
            ? message.result
            : JSON.stringify(message.result);
      }
    }

    return finalResult;
  }
}
