import { TasksService } from './tasks.service';
import { ParentTaskThreadAlreadyExistsError } from '../threads/errors/threads.errors';

describe('TasksService.createTaskInThread', () => {
  it('attaches to existing thread when thread creation races', async () => {
    const executionContextResolver = {
      resolveContext: jest.fn().mockResolvedValue({
        actorId: 'actor-1',
        parentTaskId: 'parent-task-1',
        parentThreadId: null,
        executionId: null,
        runId: 'run-1',
      }),
    };

    const agentRunsService = {
      getAgentRunById: jest.fn().mockResolvedValue({
        actorId: 'actor-1',
        parentTaskId: 'parent-task-1',
      }),
    };

    const threadsService = {
      createThread: jest
        .fn()
        .mockRejectedValue(new ParentTaskThreadAlreadyExistsError('parent-task-1')),
      findThreadByTaskId: jest.fn().mockResolvedValue({ id: 'thread-1' }),
      attachTask: jest.fn().mockResolvedValue({ id: 'thread-1' }),
    };

    const service = new TasksService(
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      agentRunsService as any,
      threadsService as any,
      executionContextResolver as any,
    );

    jest.spyOn(service, 'createTask').mockResolvedValue({ id: 'child-task-1' } as any);

    await service.createTaskInThread({
      name: 'Child task',
      description: 'Child description',
      createdByActorId: 'actor-1',
      runId: 'run-1',
    });

    expect(threadsService.createThread).toHaveBeenCalledWith({
      createdByActorId: 'actor-1',
      parentTaskId: 'parent-task-1',
      taskIds: ['child-task-1'],
    });
    expect(threadsService.findThreadByTaskId).toHaveBeenCalledWith('parent-task-1');
    expect(threadsService.attachTask).toHaveBeenCalledWith(
      'thread-1',
      'child-task-1',
    );
  });
});
