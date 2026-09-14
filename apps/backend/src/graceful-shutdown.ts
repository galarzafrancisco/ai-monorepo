import { Logger } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { getConfig } from './config/env.config';
import { ExecutionsWorkerGateway } from './executions/executions-worker.gateway';
import { ServerLifecycleService } from './server-lifecycle.service';

const logger = new Logger('GracefulShutdown');

export function installGracefulShutdownDrain(
  app: NestExpressApplication,
): void {
  const lifecycle = app.get(ServerLifecycleService);
  const close = app.close.bind(app);
  let closePromise: Promise<void> | null = null;

  app.close = (async () => {
    if (!closePromise) {
      closePromise = (async () => {
        await drainBeforeNestClose(app, lifecycle);
        await close();
      })();
    }
    return closePromise;
  }) as typeof app.close;
}

async function drainBeforeNestClose(
  app: NestExpressApplication,
  lifecycle: ServerLifecycleService,
): Promise<void> {
  lifecycle.beginShutdown();
  const signal = lifecycle.getShutdownSignal();

  await drainWorkerSockets(app, signal);
  await lifecycle.drainRequestsOnce(getConfig().httpDrainTimeoutMs);
}

async function drainWorkerSockets(
  app: NestExpressApplication,
  signal?: string,
): Promise<void> {
  try {
    const gateway = app.get(ExecutionsWorkerGateway, { strict: false });
    await gateway.drainWorkerSockets(signal);
  } catch (error) {
    logger.warn({
      message: 'Skipping worker WebSocket drain because the gateway is unavailable',
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
