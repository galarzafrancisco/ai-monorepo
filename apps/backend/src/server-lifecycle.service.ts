import {
  BeforeApplicationShutdown,
  Injectable,
  Logger,
  OnApplicationShutdown,
  OnModuleDestroy,
} from '@nestjs/common';
import { getConfig } from './config/env.config';

@Injectable()
export class ServerLifecycleService
  implements OnModuleDestroy, BeforeApplicationShutdown, OnApplicationShutdown
{
  private readonly logger = new Logger(ServerLifecycleService.name);
  private shuttingDown = false;
  private shutdownStartedAt: number | null = null;
  private shutdownSignal: string | undefined;
  private activeRequestCount = 0;
  private drainWaiters: Array<() => void> = [];

  isShuttingDown(): boolean {
    return this.shuttingDown;
  }

  isReady(): boolean {
    return !this.shuttingDown;
  }

  beginShutdown(signal?: string): boolean {
    if (this.shuttingDown) {
      this.logger.log(
        `Shutdown already in progress${this.formatSignal(signal)}; ignoring duplicate request`,
      );
      return false;
    }

    this.shuttingDown = true;
    this.shutdownStartedAt = Date.now();
    this.shutdownSignal = signal;
    this.logger.log(
      `Shutdown started${this.formatSignal(signal)}; readiness is now false`,
    );
    return true;
  }

  trackRequest(): () => void {
    this.activeRequestCount += 1;
    let released = false;

    return () => {
      if (released) {
        return;
      }
      released = true;
      this.activeRequestCount -= 1;
      if (this.activeRequestCount === 0) {
        this.resolveDrainWaiters();
      }
    };
  }

  getActiveRequestCount(): number {
    return this.activeRequestCount;
  }

  async waitForRequestsToDrain(timeoutMs: number): Promise<boolean> {
    if (this.activeRequestCount === 0) {
      return true;
    }

    this.logger.log(
      `Waiting up to ${timeoutMs}ms for ${this.activeRequestCount} active HTTP request(s) to drain`,
    );

    return new Promise<boolean>((resolve) => {
      const complete = (drained: boolean) => {
        clearTimeout(timeout);
        this.drainWaiters = this.drainWaiters.filter(
          (waiter) => waiter !== onDrain,
        );
        if (!drained) {
          this.logger.warn(
            `HTTP drain timed out with ${this.activeRequestCount} active request(s) remaining`,
          );
        }
        resolve(drained);
      };

      const onDrain = () => complete(true);
      const timeout = setTimeout(() => complete(false), timeoutMs);
      this.drainWaiters.push(onDrain);
    });
  }

  onModuleDestroy(): void {
    this.beginShutdown();
  }

  async beforeApplicationShutdown(signal?: string): Promise<void> {
    this.beginShutdown(signal);
    await this.waitForRequestsToDrain(getConfig().httpDrainTimeoutMs);
  }

  onApplicationShutdown(signal?: string): void {
    const elapsedMs = this.shutdownStartedAt
      ? Date.now() - this.shutdownStartedAt
      : 0;
    this.logger.log(
      `Shutdown completed${this.formatSignal(
        signal ?? this.shutdownSignal,
      )} after ${elapsedMs}ms`,
    );
  }

  private formatSignal(signal?: string): string {
    return signal ? ` for ${signal}` : '';
  }

  private resolveDrainWaiters(): void {
    const waiters = this.drainWaiters;
    this.drainWaiters = [];
    for (const waiter of waiters) {
      waiter();
    }
  }
}
