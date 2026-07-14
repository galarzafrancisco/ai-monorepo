jest.mock('@taico/events', () => ({
  ExecutionWireEvents: {
    WORKER_HARNESSES_REPORT_REQUESTED: 'worker:harnesses-report-requested',
  },
}));
jest.mock('../auth/guards/guards/ws-access-token-guard', () => ({
  WsAccessTokenGuard: class {},
}));
jest.mock('../auth/guards/guards/ws-scopes.guard', () => ({
  WsScopesGuard: class {},
}));
jest.mock('../auth/guards/validation/access-token-validation.service', () => ({
  AccessTokenValidationService: class {},
}));

import { ExecutionsWorkerGateway } from './executions-worker.gateway';

describe('ExecutionsWorkerGateway shutdown', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('emits draining, disconnects worker sockets, and clears timers', async () => {
    const gateway = new ExecutionsWorkerGateway({} as any, {} as any, {} as any);
    const socket = { id: 'socket-1', disconnect: jest.fn() };
    const emit = jest.fn();
    const timer = setTimeout(() => undefined, 60_000);

    (gateway as any).server = {
      sockets: { sockets: new Map([['socket-1', socket]]) },
      emit,
    };
    (gateway as any).socketExpiryTimers.set('socket-1', timer);
    (gateway as any).harnessReportRequestedSocketIds.add('socket-1');
    (gateway as any).workerSocketsByClientId.set('worker-client', new Set(['socket-1']));

    const shutdown = gateway.drainWorkerSockets('SIGTERM');
    jest.advanceTimersByTime(1_000);
    await shutdown;

    expect(emit).toHaveBeenCalledWith('server:draining', { signal: 'SIGTERM' });
    expect(socket.disconnect).toHaveBeenCalledWith(true);
    expect((gateway as any).socketExpiryTimers.size).toBe(0);
    expect((gateway as any).harnessReportRequestedSocketIds.size).toBe(0);
    expect((gateway as any).workerSocketsByClientId.size).toBe(0);
  });
});
