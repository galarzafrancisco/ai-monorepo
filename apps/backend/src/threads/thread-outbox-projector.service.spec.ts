import { ThreadEntity } from './thread.entity';
import { ThreadOutboxProjectorService } from './thread-outbox-projector.service';
import { ThreadTitleWorkflowService } from './thread-title-workflow.service';

describe('ThreadOutboxProjectorService', () => {
  it('generates a title from the parent task before relaying a created child thread', async () => {
    const parentTask = { id: 'task-1', name: 'Parent' } as never;
    const thread = {
      id: 'thread-1',
      parentTaskId: 'task-1',
      parentTask,
    } as unknown as ThreadEntity;
    const threadRepository = { findOne: jest.fn().mockResolvedValue(thread) };
    const eventEmitter = { emit: jest.fn() };
    const titleWorkflow = {
      generateFromParentTask: jest.fn().mockResolvedValue(undefined),
    } as unknown as ThreadTitleWorkflowService;
    const service = new ThreadOutboxProjectorService(
      threadRepository as never,
      eventEmitter as never,
      {} as never,
      titleWorkflow,
    );

    await service.projectCreated({
      payload: { threadId: thread.id, actorId: 'actor-1' },
    } as never);

    expect(titleWorkflow.generateFromParentTask).toHaveBeenCalledWith(
      thread,
      'actor-1',
      parentTask,
    );
    expect(eventEmitter.emit).toHaveBeenCalledTimes(1);
  });
});
