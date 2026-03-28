import {
  AgentRunCallbacks,
  AgentRunContext,
  AgentRunResult,
  AgentRunner,
} from './agent-runner.types';

export abstract class BaseAgentRunner implements AgentRunner {
  abstract readonly kind: string;

  async run(
    ctx: AgentRunContext,
    cb: AgentRunCallbacks = {},
  ): Promise<AgentRunResult> {
    const events: string[] = [];
    let sessionId: string | null = null;
    let result = '';

    const emit = async (message: string): Promise<void> => {
      events.push(message);
      await cb.onEvent?.(message);
    };

    const setSession = async (id: string): Promise<void> => {
      if (sessionId !== null) {
        return;
      }
      sessionId = id;
      await cb.onSession?.(id);
    };

    try {
      result = await this.runInternal(ctx, emit, setSession, cb.onError);
    } catch (error: unknown) {
      await emit(`❌ Agent error: ${this.errorToMessage(error)}`);
      await cb.onError?.({ message: this.errorToMessage(error), rawMessage: error });
      throw error;
    }

    return { sessionId, events, result };
  }

  protected abstract runInternal(
    ctx: AgentRunContext,
    emit: (message: string) => Promise<void>,
    setSession: (id: string) => Promise<void>,
    onError?: (error: { message: string; rawMessage?: unknown }) => void | Promise<void>,
  ): Promise<string>;

  protected errorToMessage(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }
    if (typeof error === 'string') {
      return error;
    }
    return String(error);
  }
}
