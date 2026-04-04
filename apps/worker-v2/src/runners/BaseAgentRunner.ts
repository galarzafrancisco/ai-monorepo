import { AgentRunResult, AgentRunCallbacks, AgentRunContext, AgentRunner } from "./AgentRunner.js";

export abstract class BaseAgentRunner implements AgentRunner {
  private static readonly HEARTBEAT_INTERVAL_MS = 10_000;
  private static readonly DEFAULT_CALLBACKS: AgentRunCallbacks = {
    onHeartbeat: () => undefined,
  };

  abstract readonly kind: string;

  async run(
    ctx: AgentRunContext,
    cb: AgentRunCallbacks = BaseAgentRunner.DEFAULT_CALLBACKS
  ): Promise<AgentRunResult> {
    const events: string[] = [];
    let sessionId: string | null = null;
    let result = '';
    const heartbeatTimer = setInterval(() => {
      void Promise.resolve(cb.onHeartbeat()).catch((error) => {
        console.warn(
          `[agent-runner:${this.kind}] heartbeat callback failed: ${error instanceof Error ? error.message : String(error)}`,
        );
      });
    }, BaseAgentRunner.HEARTBEAT_INTERVAL_MS);

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

    try {
      result = await this.runInternal(ctx, emit, setSession, onError);
    } catch (err: any) {
      await emit(`❌ Agent error: ${err?.message ?? String(err)}`);
    } finally {
      clearInterval(heartbeatTimer);
    }

    return { sessionId, events, result };
  }

  /**
   * Implemented per agent.
   * Must return final result string.
   */
  protected abstract runInternal(
    ctx: AgentRunContext,
    emit: (msg: string) => Promise<void>,
    setSession: (id: string) => Promise<void>,
    onError?: (error: { message: string; rawMessage?: any }) => void | Promise<void>,
  ): Promise<string>;
}
