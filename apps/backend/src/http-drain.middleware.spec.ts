import { EventEmitter } from 'events';
import { createHttpDrainMiddleware, isHealthRequest } from './http-drain.middleware';
import { ServerLifecycleService } from './server-lifecycle.service';

describe('http drain middleware', () => {
  let lifecycle: ServerLifecycleService;

  beforeEach(() => {
    lifecycle = new ServerLifecycleService();
  });

  it('identifies health requests', () => {
    expect(isHealthRequest({ path: '/health/live' } as any)).toBe(true);
    expect(isHealthRequest({ path: '/health/ready' } as any)).toBe(true);
    expect(isHealthRequest({ path: '/api/v1/tasks' } as any)).toBe(false);
  });

  it('tracks accepted non-health requests until the response closes', () => {
    const middleware = createHttpDrainMiddleware(lifecycle);
    const res = new EventEmitter() as any;
    const next = jest.fn();

    middleware({ path: '/api/v1/tasks' } as any, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(lifecycle.getActiveRequestCount()).toBe(1);

    res.emit('finish');

    expect(lifecycle.getActiveRequestCount()).toBe(0);
  });

  it('rejects new non-health requests after shutdown starts', () => {
    const middleware = createHttpDrainMiddleware(lifecycle);
    const json = jest.fn();
    const status = jest.fn(() => ({ json }));
    const next = jest.fn();

    lifecycle.beginShutdown('SIGTERM');
    middleware({ path: '/api/v1/tasks' } as any, { status } as any, next);

    expect(status).toHaveBeenCalledWith(503);
    expect(json).toHaveBeenCalledWith({
      statusCode: 503,
      message: 'Server is shutting down',
      error: 'Service Unavailable',
    });
    expect(next).not.toHaveBeenCalled();
    expect(lifecycle.getActiveRequestCount()).toBe(0);
  });

  it('allows health requests after shutdown starts', () => {
    const middleware = createHttpDrainMiddleware(lifecycle);
    const next = jest.fn();

    lifecycle.beginShutdown('SIGTERM');
    middleware({ path: '/health/ready' } as any, {} as any, next);

    expect(next).toHaveBeenCalledTimes(1);
  });
});
