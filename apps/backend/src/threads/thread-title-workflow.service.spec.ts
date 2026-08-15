import { ContextService } from '../context/context.service';
import { TaskEntity } from '../tasks/task.entity';
import { ThreadEntity } from './thread.entity';
import { ThreadTitleService } from './thread-title.service';
import { ThreadTitleWorkflowService } from './thread-title-workflow.service';

describe('ThreadTitleWorkflowService', () => {
  const thread = Object.assign(new ThreadEntity(), {
    id: 'thread-1',
    title: 'New thread',
    stateContextBlockId: 'state-block-1',
  });
  const task = Object.assign(new TaskEntity(), { id: 'task-1', name: 'Parent' });
  let queryBuilder: {
    update: jest.Mock;
    set: jest.Mock;
    where: jest.Mock;
    andWhere: jest.Mock;
    execute: jest.Mock;
  };
  let threadRepository: { createQueryBuilder: jest.Mock; findOneBy: jest.Mock };
  let titleService: jest.Mocked<Pick<ThreadTitleService, 'generateFromParentTask' | 'generateFromMessage'>>;
  let contextService: jest.Mocked<Pick<ContextService, 'updateBlock'>>;
  let eventEmitter: { emit: jest.Mock };
  let service: ThreadTitleWorkflowService;

  beforeEach(() => {
    thread.title = 'New thread';
    queryBuilder = {
      update: jest.fn(),
      set: jest.fn(),
      where: jest.fn(),
      andWhere: jest.fn(),
      execute: jest.fn(),
    };
    queryBuilder.update.mockReturnValue(queryBuilder);
    queryBuilder.set.mockReturnValue(queryBuilder);
    queryBuilder.where.mockReturnValue(queryBuilder);
    queryBuilder.andWhere.mockReturnValue(queryBuilder);
    threadRepository = {
      createQueryBuilder: jest.fn().mockReturnValue(queryBuilder),
      findOneBy: jest.fn().mockResolvedValue({ ...thread, title: 'Parent title' }),
    };
    titleService = {
      generateFromParentTask: jest.fn(),
      generateFromMessage: jest.fn(),
    };
    contextService = { updateBlock: jest.fn().mockResolvedValue(undefined) };
    eventEmitter = { emit: jest.fn() };
    service = new ThreadTitleWorkflowService(
      threadRepository as never,
      titleService as never,
      contextService as never,
      eventEmitter as never,
    );
  });

  it('generates from the parent task and updates the title, state block, and event after winning the CAS', async () => {
    titleService.generateFromParentTask.mockResolvedValue('Parent title');
    queryBuilder.execute.mockResolvedValue({ affected: 1 });

    await service.generateFromParentTask(thread, 'actor-1', task);

    expect(titleService.generateFromParentTask).toHaveBeenCalledWith(task);
    expect(queryBuilder.andWhere).toHaveBeenCalledWith(
      'LOWER(TRIM(title)) = :placeholder',
      { placeholder: 'new thread' },
    );
    expect(eventEmitter.emit).toHaveBeenCalledWith(
      expect.any(Symbol),
      expect.objectContaining({ payload: { threadId: thread.id, title: 'Parent title' } }),
    );
    expect(contextService.updateBlock).toHaveBeenCalledWith(thread.stateContextBlockId, {
      title: 'Thread State: Parent title',
    });
  });

  it.each([null, ' New thread '])('does not update for a %p candidate', async (candidate) => {
    titleService.generateFromParentTask.mockResolvedValue(candidate);

    await service.generateFromParentTask(thread, 'actor-1', task);

    expect(queryBuilder.execute).not.toHaveBeenCalled();
    expect(eventEmitter.emit).not.toHaveBeenCalled();
    expect(contextService.updateBlock).not.toHaveBeenCalled();
  });

  it('propagates generation failures so the durable outbox projection retries', async () => {
    titleService.generateFromParentTask.mockRejectedValue(new Error('LLM unavailable'));

    await expect(service.generateFromParentTask(thread, 'actor-1', task)).rejects.toThrow(
      'LLM unavailable',
    );
    expect(queryBuilder.execute).not.toHaveBeenCalled();
  });

  it('allows exactly one winner when parent and first-message generation race', async () => {
    titleService.generateFromParentTask.mockResolvedValue('Parent title');
    titleService.generateFromMessage.mockResolvedValue('Message title');
    queryBuilder.execute
      .mockResolvedValueOnce({ affected: 1 })
      .mockResolvedValueOnce({ affected: 0 });

    await Promise.all([
      service.generateFromParentTask(thread, 'actor-1', task),
      service.generateFromFirstMessage(thread, 'actor-2', 'Hello'),
    ]);

    expect(queryBuilder.execute).toHaveBeenCalledTimes(2);
    expect(eventEmitter.emit).toHaveBeenCalledTimes(1);
    expect(contextService.updateBlock).toHaveBeenCalledTimes(1);
  });
});
