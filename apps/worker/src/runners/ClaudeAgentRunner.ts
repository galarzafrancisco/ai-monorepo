// ClaudeAgentRunner.ts
import { BaseAgentRunner } from "./BaseAgentRunner.js";
import { query } from "@anthropic-ai/claude-agent-sdk";
import { ClaudeMessageFormatter } from "../formatters/ClaudeMessageFormatter.js";
import { EXECUTION_ID_HEADER } from "../helpers/config.js";
import {
  AgentModelConfig,
  AgentRunContext,
  Model,
  TokenUsage,
} from "./AgentRunner.js";
import { DEFAULT_AGENT_ALLOWED_TOOLS } from '@taico/shared';

export class ClaudeAgentRunner extends BaseAgentRunner {
  readonly kind = 'claude';
  private readonly model: Model | null;

  constructor(modelConfig: AgentModelConfig = {}) {
    super();

    if (!modelConfig.modelId) {
      this.model = null;
      return;
    }

    this.model = {
      providerId: modelConfig.providerId ?? 'anthropic',
      modelId: modelConfig.modelId,
    };
  }

  override getModel() {
    return this.model;
  }

  protected async runInternal(
    ctx: AgentRunContext,
    emit: (msg: string) => Promise<void>,
    setSession: (id: string) => Promise<void>,
    onError?: (error: { message: string; rawMessage?: any }) => void | Promise<void>,
    onToolCall?: (toolName: string) => void | Promise<void>,
    onTokenUsage?: (usage: TokenUsage) => void | Promise<void>,
  ): Promise<string> {
    const formatter = new ClaudeMessageFormatter(ctx.agentSlug);

    let finalResult = '';
    const cumulativeUsage: TokenUsage = {};
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

    // Create abort controller if external signal is provided
    let abortController: AbortController | undefined;
    if (ctx.abortSignal) {
      abortController = new AbortController();
      // Check if already aborted before we even started
      if (ctx.abortSignal.aborted) {
        abortController.abort();
      }
      ctx.abortSignal.addEventListener('abort', () => {
        abortController?.abort();
      });
    }

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
        abortController,
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

      const usage = extractClaudeTokenUsage(msg);
      if (usage) {
        if (usage.mode === 'absolute') {
          await onTokenUsage?.(applyAbsoluteUsage(cumulativeUsage, usage.usage));
        } else {
          await onTokenUsage?.(accumulateUsage(cumulativeUsage, usage.usage));
        }
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

type ClaudeUsage = {
  input_tokens?: unknown;
  output_tokens?: unknown;
  prompt_tokens?: unknown;
  completion_tokens?: unknown;
  cache_creation_input_tokens?: unknown;
  cache_read_input_tokens?: unknown;
  total_tokens?: unknown;
};

type ExtractedClaudeUsage = {
  usage: TokenUsage;
  mode: 'delta' | 'absolute';
};

function extractClaudeTokenUsage(message: unknown): ExtractedClaudeUsage | null {
  if (!message || typeof message !== 'object') {
    return null;
  }

  const typedMessage = message as {
    type?: unknown;
    message?: { usage?: ClaudeUsage };
    usage?: ClaudeUsage;
  };

  const usage = typedMessage.message?.usage ?? typedMessage.usage;
  if (!usage) {
    return null;
  }

  const inputTokens = sumTokenCounts(
    toTokenCount(usage.input_tokens ?? usage.prompt_tokens),
    toTokenCount(usage.cache_creation_input_tokens),
    toTokenCount(usage.cache_read_input_tokens),
  );
  const outputTokens = toTokenCount(
    usage.output_tokens ?? usage.completion_tokens,
  );
  let totalTokens = toTokenCount(usage.total_tokens);

  if (
    totalTokens === null &&
    inputTokens !== null &&
    outputTokens !== null
  ) {
    totalTokens = inputTokens + outputTokens;
  }

  if (inputTokens === null && outputTokens === null && totalTokens === null) {
    return null;
  }

  return {
    usage: {
      inputTokens,
      outputTokens,
      totalTokens,
    },
    mode: typedMessage.type === 'result' ? 'absolute' : 'delta',
  };
}

function sumTokenCounts(...values: Array<number | null>): number | null {
  let hasValue = false;
  let total = 0;

  for (const value of values) {
    if (value === null) {
      continue;
    }

    hasValue = true;
    total += value;
  }

  if (!hasValue) {
    return null;
  }

  return total;
}

function toTokenCount(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    return null;
  }

  return Math.trunc(value);
}

function accumulateUsage(current: TokenUsage, next: TokenUsage): TokenUsage {
  const inputDelta = next.inputTokens;
  if (typeof inputDelta === 'number') {
    current.inputTokens = (current.inputTokens ?? 0) + inputDelta;
  }

  const outputDelta = next.outputTokens;
  if (typeof outputDelta === 'number') {
    current.outputTokens = (current.outputTokens ?? 0) + outputDelta;
  }

  const totalDelta = next.totalTokens;
  if (typeof totalDelta === 'number') {
    current.totalTokens = (current.totalTokens ?? 0) + totalDelta;
  } else if (
    typeof current.inputTokens === 'number' &&
    typeof current.outputTokens === 'number'
  ) {
    current.totalTokens = current.inputTokens + current.outputTokens;
  }

  return {
    inputTokens: current.inputTokens,
    outputTokens: current.outputTokens,
    totalTokens: current.totalTokens,
  };
}

function applyAbsoluteUsage(current: TokenUsage, absolute: TokenUsage): TokenUsage {
  if (typeof absolute.inputTokens === 'number') {
    current.inputTokens = absolute.inputTokens;
  }

  if (typeof absolute.outputTokens === 'number') {
    current.outputTokens = absolute.outputTokens;
  }

  if (typeof absolute.totalTokens === 'number') {
    current.totalTokens = absolute.totalTokens;
  } else if (
    typeof current.inputTokens === 'number' &&
    typeof current.outputTokens === 'number'
  ) {
    current.totalTokens = current.inputTokens + current.outputTokens;
  }

  return {
    inputTokens: current.inputTokens,
    outputTokens: current.outputTokens,
    totalTokens: current.totalTokens,
  };
}
