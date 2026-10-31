import {
  AgentRunResult,
  AgentRunCallbacks,
  AgentRunContext,
  AgentRunner,
  Model,
  TokenUsage,
} from "./AgentRunner.js";

export abstract class BaseAgentRunner implements AgentRunner {
  private static readonly HEARTBEAT_INTERVAL_MS = 10_000;
  private static readonly DEFAULT_CALLBACKS: AgentRunCallbacks = {
    onHeartbeat: () => undefined,
  };

  protected readonly usePeriodicHeartbeat: boolean = true;

  abstract readonly kind: string;
  private onRawEvent?: (event: unknown) => void;

  protected emitRawEvent(event: unknown): void {
    this.onRawEvent?.(event);
  }

  getModel(): Model | null {
    return null;
  }

  cancel(): void | Promise<void> {
    return undefined;
  }

  async run(
    ctx: AgentRunContext,
    cb: AgentRunCallbacks = BaseAgentRunner.DEFAULT_CALLBACKS
  ): Promise<AgentRunResult> {
    this.onRawEvent = cb.onRawEvent;
    const events: string[] = [];
    let sessionId: string | null = null;
    let result = '';
    const emitHeartbeat = async () => {
      try {
        await cb.onHeartbeat();
      } catch (error) {
        console.warn(
          `[agent-runner:${this.kind}] heartbeat callback failed: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    };
    const heartbeatTimer = this.usePeriodicHeartbeat
      ? setInterval(() => {
          void emitHeartbeat();
        }, BaseAgentRunner.HEARTBEAT_INTERVAL_MS)
      : undefined;

    const emit = async (msg: string) => {
      events.push(msg);
      if (cb.onEvent) await cb.onEvent(msg);
    };

    const setSession = async (id: string) => {
      if (sessionId == null) {
        sessionId = id;
        if (cb.onSession) await cb.onSession(id);
      }
    };

    const onError = cb.onError;
    const onToolCall = async (toolName: string) => {
      if (!cb.onToolCall) {
        return;
      }
      await cb.onToolCall(toolName);
    };
    const onTokenUsage = async (usage: TokenUsage) => {
      if (!cb.onTokenUsage) {
        return;
      }
      await cb.onTokenUsage(usage);
    };

    try {
      result = await this.runInternal(
        ctx,
        emit,
        setSession,
        onError,
        onToolCall,
        onTokenUsage,
        emitHeartbeat,
      );
    } catch (err: any) {
      await emit(`❌ Agent error: ${err?.message ?? String(err)}`);
      throw err;
    } finally {
      this.onRawEvent = undefined;
      if (heartbeatTimer) {
        clearInterval(heartbeatTimer);
      }
    }

    return { sessionId, events, result };
  }

  /**
   * Implemented per agent.
   * Must return final result string.
   */
  /**
   * The worker's environment plus the run's extra variables, for harnesses
   * that take a whole environment. Undefined when the run adds nothing, so the
   * harness keeps its default (inheriting the worker's).
   */
  protected harnessEnv(ctx: AgentRunContext): Record<string, string> | undefined {
    if (!ctx.env || Object.keys(ctx.env).length === 0) return undefined;
    const inherited = Object.fromEntries(
      Object.entries(process.env).filter((entry): entry is [string, string] => entry[1] !== undefined),
    );
    return { ...inherited, ...ctx.env };
  }

  protected static readonly FOLLOW_UP_MESSAGE =
    '↩️ Turn finished. Sending the follow-up prompt.';

  protected abstract runInternal(
    ctx: AgentRunContext,
    emit: (msg: string) => Promise<void>,
    setSession: (id: string) => Promise<void>,
    onError?: (error: { message: string; rawMessage?: any }) => void | Promise<void>,
    onToolCall?: (toolName: string) => void | Promise<void>,
    onTokenUsage?: (usage: TokenUsage) => void | Promise<void>,
    onHeartbeat?: () => void | Promise<void>,
  ): Promise<string>;
}
