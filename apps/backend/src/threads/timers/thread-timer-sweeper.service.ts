import { Injectable, Logger } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { ThreadAgentService } from '../agent/thread-agent.service';
import { ThreadTimersService } from './thread-timers.service';

/** How often each backend process looks for due timers. Timers fire up to this late. */
export const TIMER_SWEEP_INTERVAL_MS = 5_000;

/**
 * Fires due reminders and schedules. Every backend process runs the sweep;
 * each firing is claimed by one of them, which then wakes the threads agent.
 */
@Injectable()
export class ThreadTimerSweeperService {
  private readonly logger = new Logger(ThreadTimerSweeperService.name);
  private running = false;

  constructor(
    private readonly timers: ThreadTimersService,
    private readonly threadAgentService: ThreadAgentService,
  ) {}

  @Interval(TIMER_SWEEP_INTERVAL_MS)
  async sweep(): Promise<void> {
    // A slow sweep is not overlapped by the next tick.
    if (this.running) {
      return;
    }
    this.running = true;

    try {
      const threadIds = await this.timers.fireDue();
      // The firing is stored; the turn that delivers it may run on any backend process.
      for (const threadId of threadIds) {
        this.threadAgentService.requestTurn(threadId);
      }
    } catch (error) {
      this.logger.warn({
        message: 'Failed to fire due thread timers',
        error: error instanceof Error ? error.message : String(error),
      });
    } finally {
      this.running = false;
    }
  }
}
