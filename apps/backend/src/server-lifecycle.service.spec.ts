import { INestApplication, Injectable, OnModuleDestroy } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
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

  it('marks shutdown during module destroy for programmatic app close', () => {
    service.onModuleDestroy();

    expect(service.isReady()).toBe(false);
  });

  it('marks readiness false before later module destroy hooks run', async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ServerLifecycleService, ShutdownProbe],
    }).compile();
    const app: INestApplication = module.createNestApplication();
    await app.init();

    const probe = app.get(ShutdownProbe);

    await app.close();

    expect(probe.observedReadyDuringModuleDestroy).toBe(false);
  });
});
