import { ServerLifecycleService } from './server-lifecycle.service';

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
});
