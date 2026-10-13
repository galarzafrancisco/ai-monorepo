import { Inject, Injectable, Logger } from '@nestjs/common';
import { ThreadAgentLogService } from '../thread-agent-log.service';
import { formatTurnContext } from '../thread-agent.prompts';
import {
  ThreadAgentMessageKind,
  ThreadAgentMessageRole,
} from '../thread-agent.enums';
import {
  AfterTurnContext,
  BeforeTurnContext,
  THREAD_AGENT_HOOKS,
  ThreadAgentHook,
  TurnContext,
} from './thread-agent-hook.interface';

const BEFORE_TURN_TIMEOUT_MS = 5_000;
const AFTER_TURN_TIMEOUT_MS = 120_000;

function withTimeout<T>(work: Promise<T>, timeoutMs: number, hookName: string): Promise<T> {
  let timer: NodeJS.Timeout;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new Error(`Hook ${hookName} timed out after ${timeoutMs}ms`)),
      timeoutMs,
    );
  });
  return Promise.race([work, timeout]).finally(() => clearTimeout(timer));
}

/** Runs hooks with a time limit. A failing hook is logged and never blocks the turn. */
@Injectable()
export class ThreadAgentHooksRunner {
  private readonly logger = new Logger(ThreadAgentHooksRunner.name);

  constructor(
    @Inject(THREAD_AGENT_HOOKS) private readonly hooks: ThreadAgentHook[],
    private readonly agentLog: ThreadAgentLogService,
  ) {}

  /**
   * Returns what the hooks want the model to know for this turn. The caller puts
   * it in the turn's system instructions. Each entry is also stored in the agent
   * log as a system row, as a record of why the agent answered the way it did;
   * system rows are never replayed as conversation messages.
   */
  async runBeforeTurn(context: BeforeTurnContext): Promise<TurnContext[]> {
    const added: TurnContext[] = [];

    for (const hook of this.hooks) {
      if (!hook.beforeTurn) {
        continue;
      }

      try {
        const text = await withTimeout(
          hook.beforeTurn(context),
          BEFORE_TURN_TIMEOUT_MS,
          hook.name,
        );
        if (!text?.trim()) {
          continue;
        }
        const turnContext: TurnContext = { source: hook.name, text: text.trim() };

        await this.agentLog.append(context.threadId, [
          {
            role: ThreadAgentMessageRole.SYSTEM,
            kind: ThreadAgentMessageKind.INJECTION,
            source: `hook:${hook.name}`,
            turnId: context.turnId,
            message: { role: 'system', content: formatTurnContext(turnContext) },
          },
        ]);
        added.push(turnContext);
      } catch (error) {
        this.logFailure(hook, 'beforeTurn', context.threadId, error);
      }
    }

    return added;
  }

  async runAfterTurn(context: AfterTurnContext): Promise<void> {
    for (const hook of this.hooks) {
      if (!hook.afterTurn) {
        continue;
      }

      try {
        await withTimeout(hook.afterTurn(context), AFTER_TURN_TIMEOUT_MS, hook.name);
      } catch (error) {
        this.logFailure(hook, 'afterTurn', context.threadId, error);
      }
    }
  }

  private logFailure(
    hook: ThreadAgentHook,
    phase: 'beforeTurn' | 'afterTurn',
    threadId: string,
    error: unknown,
  ): void {
    this.logger.warn({
      message: 'Thread agent hook failed',
      hook: hook.name,
      phase,
      threadId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
