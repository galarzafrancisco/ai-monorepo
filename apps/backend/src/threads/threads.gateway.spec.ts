import { ThreadWireEvents } from '@taico/events';
import { ThreadAgentActivityEvent } from './events/threads.events';
import { ThreadsGateway } from './threads.gateway';

jest.mock('src/auth/guards/guards/ws-access-token-guard', () => ({ WsAccessTokenGuard: class {} }));
jest.mock('src/auth/guards/guards/ws-scopes.guard', () => ({ WsScopesGuard: class {} }));
jest.mock('./threads.service', () => ({ ThreadsService: class {} }));

describe('ThreadsGateway agent activity', () => {
  it('sends tool arguments and results only to the delegated actor, not another thread subscriber', () => {
    const room = 'threads-thread-1';
    const allowed = { id: 'socket-a', rooms: new Set([room]), data: { auth: { claims: { actor_id: 'actor-a' } } }, emit: jest.fn() };
    const other = { id: 'socket-b', rooms: new Set([room]), data: { auth: { claims: { actor_id: 'actor-b' } } }, emit: jest.fn() };
    const broadcast = jest.fn();
    const except = jest.fn().mockReturnValue({ emit: broadcast });
    const gateway = new ThreadsGateway({} as never);
    gateway.server = { sockets: { sockets: new Map([[allowed.id, allowed], [other.id, other]]) }, to: jest.fn().mockReturnValue({ except }) } as never;

    gateway.handleAgentActivity(new ThreadAgentActivityEvent(
      { id: 'agent' },
      { threadId: 'thread-1', turnId: 'turn', kind: 'tool_result', toolCallId: 'call', toolName: 'tasks_get', detailActorId: 'actor-a', input: '{"secret":"private"}', output: '{"task":"restricted"}' },
    ));

    expect(allowed.emit).toHaveBeenCalledWith(ThreadWireEvents.AGENT_ACTIVITY, expect.objectContaining({
      payload: expect.objectContaining({ input: '{"secret":"private"}', output: '{"task":"restricted"}' }),
    }));
    expect(except).toHaveBeenCalledWith([allowed.id]);
    expect(broadcast).toHaveBeenCalledWith(ThreadWireEvents.AGENT_ACTIVITY, expect.objectContaining({
      payload: expect.objectContaining({ toolName: 'tasks_get' }),
    }));
    const metadata = broadcast.mock.calls[0][1].payload;
    expect(metadata).not.toHaveProperty('input');
    expect(metadata).not.toHaveProperty('output');
    expect(metadata).not.toHaveProperty('detailActorId');
    expect(other.emit).not.toHaveBeenCalled();
  });
});
