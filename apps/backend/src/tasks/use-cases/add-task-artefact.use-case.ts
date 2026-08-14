import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { OutboxEventTypes } from '../../outbox/outbox-event-types';
import { OutboxWriterService } from '../../outbox/outbox-writer.service';
import { ArtefactEntity } from '../artefact.entity';
import { CreateArtefactInput } from '../dto/service/tasks.service.types';
import { TaskNotFoundError } from '../errors/tasks.errors';
import { TaskEntity } from '../task.entity';

@Injectable()
export class AddTaskArtefactUseCase {
  constructor(
    private readonly dataSource: DataSource,
    private readonly outboxWriter: OutboxWriterService,
  ) {}

  async execute(
    taskId: string,
    input: CreateArtefactInput,
    actorId: string,
  ): Promise<ArtefactEntity> {
    return this.dataSource.transaction(async (manager) => {
      const taskRepository = manager.getRepository(TaskEntity);
      const artefactRepository = manager.getRepository(ArtefactEntity);
      const task = await taskRepository.findOne({ where: { id: taskId } });
      if (!task) throw new TaskNotFoundError(taskId);
      const saved = await artefactRepository.save(
        artefactRepository.create({ task, name: input.name, link: input.link }),
      );
      const artefact = await artefactRepository.findOne({
        where: { id: saved.id },
        relations: ['task'],
      });
      if (!artefact) {
        throw new Error(`Artefact ${saved.id} was not found after creation`);
      }
      await this.outboxWriter.enqueue(manager, {
        type: OutboxEventTypes.TASK_ARTEFACT_ADDED,
        actorId,
        aggregateType: 'task',
        aggregateId: taskId,
        payload: { taskId, artefactId: saved.id, actorId },
      });
      return artefact;
    });
  }
}
