import { ThreadStateReconcilerService } from './thread-state-reconciler.service';

jest.mock('src/config/env.config', () => ({
  getConfig: () => ({ threadStateReconcilerDebounceMs: 1 }),
  isThreadStateReconcilerEnabled: () => true,
}));
jest.mock('./threads.service', () => ({ ThreadsService: class {} }));
jest.mock('./chat.service', () => ({ ChatService: class {} }));

describe('ThreadStateReconcilerService', () => {
  const thread = {
    id: 'thread-1',
    title: 'Plan',
    parentTaskId: null,
    stateContextBlockId: 'block-1',
    createdByActor: { id: 'creator-1' },
    tasks: [],
  };

  const setup = () => {
    const runTask = jest.fn(async () => undefined);
    const service = new ThreadStateReconcilerService(
      { getThreadById: jest.fn(async () => thread) } as never,
      { runTask } as never,
      { findOne: jest.fn(async () => ({ id: 'agent-actor' })) } as never,
    );
    return { service, runTask };
  };

  it('runs unattended, on behalf of the thread creator rather than whoever changed the task', async () => {
    const { service, runTask } = setup();

    await (service as any).reconcileThreadStateBatch('thread-1', [
      {
        threadId: 'thread-1',
        taskId: 'task-1',
        actorId: 'agent-actor',
        kind: 'status_changed',
        activitySummary: 'Task changed status to DONE.',
      },
    ]);
    service.onModuleDestroy();

    expect(runTask).toHaveBeenCalledWith(
      expect.objectContaining({
        actor: { id: 'agent-actor' },
        onBehalfOf: expect.objectContaining({ actorId: 'creator-1', automated: true }),
      }),
    );
  });
});
