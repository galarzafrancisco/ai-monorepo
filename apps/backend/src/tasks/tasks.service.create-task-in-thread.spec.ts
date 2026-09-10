import { TasksService } from './tasks.service';
import { ParentTaskThreadAlreadyExistsError } from '../threads/errors/threads.errors';

describe('TasksService.createTaskInThread', () => {
  it('attaches to existing thread when thread creation races', async () => {
    const executionContextResolver = {
      resolveContext: jest.fn().mockResolvedValue({
        actorId: 'actor-1',
        parentTaskId: 'parent-task-1',
        parentThreadId: null,
        executionId: 'execution-1',
        runId: null,
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
      findThreadByParentTaskId: jest.fn().mockResolvedValue({ id: 'thread-1' }),
      findThreadByTaskId: jest.fn(),
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
      executionId: 'execution-1',
    });

    expect(threadsService.createThread).toHaveBeenCalledWith({
      createdByActorId: 'actor-1',
      parentTaskId: 'parent-task-1',
      taskIds: ['child-task-1'],
    });
    expect(threadsService.findThreadByParentTaskId).toHaveBeenCalledWith(
      'parent-task-1',
    );
    expect(threadsService.findThreadByTaskId).not.toHaveBeenCalled();
    expect(threadsService.attachTask).toHaveBeenCalledWith(
      'thread-1',
      'child-task-1',
    );
  });
});
