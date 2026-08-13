jest.mock('@taico/errors', () => ({
  ErrorCodes: { TASK_NOT_FOUND: 'TASK_NOT_FOUND' },
}));

import { DataSource, EntityManager, Repository } from 'typeorm';
import { ArtefactEntity } from '../artefact.entity';
import { TaskEntity } from '../task.entity';
import { OutboxEventEntity } from '../../outbox/outbox-event.entity';
import { OutboxEventTypes } from '../../outbox/outbox-event-types';
import { OutboxWriterService } from '../../outbox/outbox-writer.service';
import { AddTaskArtefactUseCase } from './add-task-artefact.use-case';

describe('AddTaskArtefactUseCase', () => {
  it('persists the artefact and event through one transaction manager', async () => {
    const task = Object.assign(new TaskEntity(), { id: 'task-1' });
    const artefact = Object.assign(new ArtefactEntity(), {
      id: 'artefact-1',
      task,
      name: 'Design',
      link: 'https://example.test/design',
    });
    const taskRepository = Object.create(
      Repository.prototype,
    ) as Repository<TaskEntity>;
    jest.spyOn(taskRepository, 'findOne').mockResolvedValue(task);
    const artefactRepository = Object.create(
      Repository.prototype,
    ) as Repository<ArtefactEntity>;
    jest
      .spyOn(artefactRepository, 'create')
      .mockImplementation((input) =>
        Object.assign(new ArtefactEntity(), input),
      );
    jest.spyOn(artefactRepository, 'save').mockResolvedValue(artefact);
    jest.spyOn(artefactRepository, 'findOne').mockResolvedValue(artefact);
    const manager = Object.create(EntityManager.prototype) as EntityManager;
    Object.defineProperty(manager, 'getRepository', {
      value: (entity: typeof TaskEntity | typeof ArtefactEntity) =>
        entity === TaskEntity ? taskRepository : artefactRepository,
    });
    const dataSource = Object.create(DataSource.prototype) as DataSource;
    Object.defineProperty(dataSource, 'transaction', {
      value: jest.fn(
        async (
          callback: (transactionManager: EntityManager) => Promise<unknown>,
        ) => callback(manager),
      ),
    });
    const outboxWriter = Object.create(
      OutboxWriterService.prototype,
    ) as OutboxWriterService;
    const enqueue = jest
      .spyOn(outboxWriter, 'enqueue')
      .mockResolvedValue(
        Object.assign(new OutboxEventEntity(), { id: 'event-1' }),
      );

    const useCase = new AddTaskArtefactUseCase(dataSource, outboxWriter);
    await useCase.execute(
      task.id,
      { name: artefact.name, link: artefact.link },
      'actor-1',
    );

    expect(enqueue).toHaveBeenCalledWith(
      manager,
      expect.objectContaining({
        type: OutboxEventTypes.TASK_ARTEFACT_ADDED,
        payload: {
          taskId: task.id,
          artefactId: artefact.id,
          actorId: 'actor-1',
        },
      }),
    );
  });
});
