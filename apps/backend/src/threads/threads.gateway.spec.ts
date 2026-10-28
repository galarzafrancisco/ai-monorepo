import { ThreadWireEvents } from '@taico/events';
import { ThreadAgentActivityEvent } from './events/threads.events';
import { ThreadsGateway } from './threads.gateway';

jest.mock('src/auth/guards/guards/ws-access-token-guard', () => ({ WsAccessTokenGuard: class {} }));
jest.mock('src/auth/guards/guards/ws-scopes.guard', () => ({ WsScopesGuard: class {} }));
jest.mock('./threads.service', () => ({ ThreadsService: class {} }));

describe('ThreadsGateway agent activity', () => {
  it('routes details across instances only to the authenticated actor subscribed to the thread', async () => {
    const sockets = [
      { id: 'remote-allowed', actorId: 'actor-a' },
      { id: 'remote-other', actorId: 'actor-b' },
      { id: 'remote-unsubscribed', actorId: 'actor-a' },
    ].map(({ id, actorId }) => {
      const rooms = new Set<string>();
      return { id, rooms, data: { auth: { claims: { actor_id: actorId } } }, emit: jest.fn<void, [string, { payload: Record<string, unknown> }]>(),
        join: (room: string) => rooms.add(room), leave: (room: string) => rooms.delete(room) };
    });
    // Both gateway instances share the adapter's room routing. None of the
    // receiving sockets is local to the gateway that emits the event.
    const createServer = () => ({
      to: (room: string) => ({
        emit: (name: string, event: { payload: Record<string, unknown> }) => sockets.filter((socket) => socket.rooms.has(room))
          .forEach((socket) => socket.emit(name, event)),
        except: (excluded: string) => ({ emit: (name: string, event: { payload: Record<string, unknown> }) =>
          sockets.filter((socket) => socket.rooms.has(room) && !socket.rooms.has(excluded))
            .forEach((socket) => socket.emit(name, event)) }),
      }),
    });
    const service = { getThreadById: jest.fn().mockResolvedValue({ id: 'thread-1' }) };
    const receiver = new ThreadsGateway(service as never);
    receiver.server = createServer() as never;
    await receiver.subscribe(sockets[0] as never, { threadId: 'thread-1' });
    await receiver.subscribe(sockets[1] as never, { threadId: 'thread-1' });
    expect(sockets[2].rooms.size).toBe(0);

    const emitter = new ThreadsGateway(service as never);
    emitter.server = createServer() as never;
    emitter.handleAgentActivity(new ThreadAgentActivityEvent(
      { id: 'agent' },
      { threadId: 'thread-1', turnId: 'turn', kind: 'tool_result', toolCallId: 'call', toolName: 'tasks_get', detailActorId: 'actor-a', input: '{"secret":"private"}', output: '{"task":"restricted"}' },
    ));

    expect(sockets[0].emit).toHaveBeenCalledTimes(1);
    expect(sockets[0].emit).toHaveBeenCalledWith(ThreadWireEvents.AGENT_ACTIVITY, expect.objectContaining({
      payload: expect.objectContaining({ input: '{"secret":"private"}', output: '{"task":"restricted"}' }),
    }));
    expect(sockets[1].emit).toHaveBeenCalledTimes(1);
    const metadata = sockets[1].emit.mock.calls[0][1].payload;
    expect(metadata.toolName).toBe('tasks_get');
    expect(metadata).not.toHaveProperty('input');
    expect(metadata).not.toHaveProperty('output');
    expect(metadata).not.toHaveProperty('detailActorId');
    expect(sockets[2].emit).not.toHaveBeenCalled();

    await receiver.unsubscribe(sockets[0] as never, { threadId: 'thread-1' });
    emitter.handleAgentActivity(new ThreadAgentActivityEvent(
      { id: 'agent' },
      { threadId: 'thread-1', turnId: 'turn', kind: 'tool_result', detailActorId: 'actor-a', output: 'private' },
    ));
    expect(sockets[0].emit).toHaveBeenCalledTimes(1);
  });
});
