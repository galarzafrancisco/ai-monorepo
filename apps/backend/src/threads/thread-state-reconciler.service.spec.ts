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
    const getThreadById = jest.fn(async () => thread);
    const service = new ThreadStateReconcilerService(
      {
        getThreadById,
      } as never,
      { runTask } as never,
      { findOne: jest.fn(async () => ({ id: 'agent-actor' })) } as never,
    );
    return { service, runTask, getThreadById };
  };

  it('runs unattended, on behalf of the thread creator rather than whoever changed the task', async () => {
    const { service, runTask, getThreadById } = setup();

    await (service as any).reconcileThreadStateBatch('thread-1', [
      {
        threadId: 'thread-1',
        workspaceId: 'workspace-1',
        taskId: 'task-1',
        actorId: 'agent-actor',
        kind: 'status_changed',
        activitySummary: 'Task changed status to DONE.',
      },
    ]);
    service.onModuleDestroy();

    // The thread is read in the task's workspace.
    expect(getThreadById).toHaveBeenCalledWith('workspace-1', 'thread-1');

    expect(runTask).toHaveBeenCalledWith(
      expect.objectContaining({
        actor: { id: 'agent-actor' },
        workspaceId: 'workspace-1',
        onBehalfOf: expect.objectContaining({ actorId: 'creator-1', automated: true }),
      }),
    );
  });
});
