jest.mock('@taico/errors', () => ({
  ErrorCodes: {
    TASK_NOT_FOUND: 'TASK_NOT_FOUND',
  },
}));

jest.mock('../threads/threads.service', () => ({
  ThreadsService: jest.fn(),
}));

import { TasksService } from './tasks.service';
import { ArtefactAddedEvent } from './events/tasks.events';

describe('TasksService addArtefact', () => {
  const task = { id: 'task-1' } as any;

  function createArtefact(overrides: Record<string, unknown> = {}) {
    return {
      id: 'artefact-1',
      taskId: task.id,
      task,
      name: 'Pull Request',
      link: 'https://github.com/org/repo/pull/1',
      createdAt: new Date('2026-01-01T00:00:00Z'),
      ...overrides,
    } as any;
  }

  function createService() {
    const taskRepository = {
      findOne: jest.fn().mockResolvedValue(task),
    };
    const artefactRepository = {
      findOne: jest.fn(),
      create: jest.fn((artefact) => artefact),
      save: jest.fn(async (artefact) => ({ ...artefact, id: 'artefact-new' })),
    };
    const eventEmitter = { emit: jest.fn() };

    const service = new TasksService(
      taskRepository as any,
      {} as any,
      artefactRepository as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      eventEmitter as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
    );

    return { service, artefactRepository, eventEmitter };
  }

  it('silently skips an artefact whose link already exists on the task', async () => {
    const { service, artefactRepository, eventEmitter } = createService();
    const existing = createArtefact();
    artefactRepository.findOne.mockResolvedValueOnce(existing);

    const result = await service.addArtefact(
      task.id,
      { name: 'Pull Request', link: existing.link },
      'actor-1',
    );

    expect(artefactRepository.findOne).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { taskId: task.id, link: existing.link },
      }),
    );
    expect(artefactRepository.save).not.toHaveBeenCalled();
    expect(eventEmitter.emit).not.toHaveBeenCalled();
    expect(result.id).toBe(existing.id);
  });

  it('creates the artefact when the link is new for the task', async () => {
    const { service, artefactRepository, eventEmitter } = createService();
    const created = createArtefact({ id: 'artefact-new' });
    artefactRepository.findOne
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(created);

    const result = await service.addArtefact(
      task.id,
      { name: 'Pull Request', link: created.link },
      'actor-1',
    );

    expect(artefactRepository.save).toHaveBeenCalledTimes(1);
    expect(eventEmitter.emit).toHaveBeenCalledWith(
      ArtefactAddedEvent.INTERNAL,
      expect.any(ArtefactAddedEvent),
    );
    expect(result.id).toBe('artefact-new');
  });
});
