import {
  BeforeApplicationShutdown,
  Injectable,
  Logger,
  OnApplicationShutdown,
  OnModuleDestroy,
} from '@nestjs/common';

@Injectable()
export class ServerLifecycleService
  implements OnModuleDestroy, BeforeApplicationShutdown, OnApplicationShutdown
{
  private readonly logger = new Logger(ServerLifecycleService.name);
  private shuttingDown = false;
  private shutdownStartedAt: number | null = null;
  private shutdownSignal: string | undefined;

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

  onModuleDestroy(): void {
    this.beginShutdown();
  }

  beforeApplicationShutdown(signal?: string): void {
    this.beginShutdown(signal);
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
}
