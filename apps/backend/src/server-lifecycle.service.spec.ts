jest.mock('@taico/events', () => ({
  ExecutionWireEvents: {
    WORKER_HARNESSES_REPORT_REQUESTED: 'worker:harnesses-report-requested',
  },
}));
jest.mock('./auth/guards/guards/ws-access-token-guard', () => ({
  WsAccessTokenGuard: class {},
}));
jest.mock('./auth/guards/guards/ws-scopes.guard', () => ({
  WsScopesGuard: class {},
}));
jest.mock('./auth/guards/validation/access-token-validation.service', () => ({
  AccessTokenValidationService: class {},
}));

import { INestApplication, Injectable, OnModuleDestroy } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { Test, TestingModule } from '@nestjs/testing';
import { installGracefulShutdownDrain } from './graceful-shutdown';
import { ServerLifecycleService } from './server-lifecycle.service';

@Injectable()
class ShutdownProbe implements OnModuleDestroy {
  observedReadyDuringModuleDestroy: boolean | null = null;

  constructor(private readonly lifecycle: ServerLifecycleService) {}

  onModuleDestroy(): void {
    this.observedReadyDuringModuleDestroy = this.lifecycle.isReady();
  }
}

describe('ServerLifecycleService', () => {
  let service: ServerLifecycleService;

  beforeEach(() => {
    service = new ServerLifecycleService();
  });

  it('is ready before shutdown starts', () => {
    expect(service.isReady()).toBe(true);
    expect(service.isShuttingDown()).toBe(false);
  });

  it('is not ready after shutdown starts', () => {
    expect(service.beginShutdown('SIGTERM')).toBe(true);

    expect(service.isReady()).toBe(false);
    expect(service.isShuttingDown()).toBe(true);
  });

  it('makes repeated shutdown starts idempotent', () => {
    expect(service.beginShutdown('SIGTERM')).toBe(true);
    expect(service.beginShutdown('SIGINT')).toBe(false);

    expect(service.isReady()).toBe(false);
  });

  it('marks readiness false before module destroy hooks run', async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ServerLifecycleService, ShutdownProbe],
    }).compile();
    const app: INestApplication = module.createNestApplication();
    installGracefulShutdownDrain(app as NestExpressApplication);
    await app.init();

    const probe = app.get(ShutdownProbe);

    await app.close();

    expect(probe.observedReadyDuringModuleDestroy).toBe(false);
  });

  it('waits for active requests before module destroy hooks run', async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ServerLifecycleService, ShutdownProbe],
    }).compile();
    const app: INestApplication = module.createNestApplication();
    installGracefulShutdownDrain(app as NestExpressApplication);
    await app.init();

    const lifecycle = app.get(ServerLifecycleService);
    const probe = app.get(ShutdownProbe);
    const release = lifecycle.trackRequest();

    const close = app.close();
    await new Promise((resolve) => setImmediate(resolve));

    expect(probe.observedReadyDuringModuleDestroy).toBeNull();

    release();
    await close;

    expect(probe.observedReadyDuringModuleDestroy).toBe(false);
  });

  it('tracks active requests until they release', () => {
    const releaseFirst = service.trackRequest();
    const releaseSecond = service.trackRequest();

    expect(service.getActiveRequestCount()).toBe(2);

    releaseFirst();
    releaseFirst();
    expect(service.getActiveRequestCount()).toBe(1);

    releaseSecond();
    expect(service.getActiveRequestCount()).toBe(0);
  });

  it('waits for active requests to drain', async () => {
    const release = service.trackRequest();
    const drained = service.waitForRequestsToDrain(100);

    release();

    await expect(drained).resolves.toBe(true);
  });

  it('times out when active requests do not drain', async () => {
    service.trackRequest();

    await expect(service.waitForRequestsToDrain(1)).resolves.toBe(false);
  });
});
