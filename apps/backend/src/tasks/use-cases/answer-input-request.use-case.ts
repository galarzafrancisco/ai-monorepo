import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { OutboxEventTypes } from '../../outbox/outbox-event-types';
import { OutboxWriterService } from '../../outbox/outbox-writer.service';
import { AnswerInputRequestInput } from '../dto/service/tasks.service.types';
import { InputRequestEntity } from '../input-request.entity';

@Injectable()
export class AnswerInputRequestUseCase {
  constructor(
    private readonly dataSource: DataSource,
    private readonly outboxWriter: OutboxWriterService,
  ) {}

  async execute(
    taskId: string,
    inputRequestId: string,
    input: AnswerInputRequestInput,
    actorId: string,
  ): Promise<InputRequestEntity> {
    return this.dataSource.transaction(async (manager) => {
      const repository = manager.getRepository(InputRequestEntity);
      const request = await repository.findOne({
        where: { id: inputRequestId, taskId },
      });
      if (!request) {
        throw new Error(
          `Input request ${inputRequestId} not found for task ${taskId}`,
        );
      }
      request.answer = input.answer;
      request.resolvedAt = new Date();
      const saved = await repository.save(request);
      await this.outboxWriter.enqueue(manager, {
        type: OutboxEventTypes.TASK_INPUT_REQUEST_ANSWERED,
        actorId,
        aggregateType: 'task',
        aggregateId: taskId,
        payload: { taskId, inputRequestId, actorId },
      });
      return saved;
    });
  }
}
