import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ActiveTaskExecutionEntity } from './active/active-task-execution.entity';
import { ActiveTaskExecutionNotFoundError } from './errors/executions-v2.errors';
import { ExecutionActivityEvent } from './events/execution-activity.events';

export type PublishExecutionActivityInput = {
  executionId: string;
  kind?: string;
  message?: string;
  ts?: number;
  runnerSessionId?: string | null;
};

export type PublishSystemExecutionActivityInput = {
  executionId: string;
  taskId: string;
  agentActorId: string;
  kind: string;
  message?: string;
  ts?: number;
};

export type TouchExecutionHeartbeatInput = {
  executionId: string;
};

@Injectable()
export class ExecutionActivityService {
  constructor(
    @InjectRepository(ActiveTaskExecutionEntity)
    private readonly activeTaskExecutionRepository: Repository<ActiveTaskExecutionEntity>,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async publishActivity(
    input: PublishExecutionActivityInput,
  ): Promise<void> {
    const execution = await this.activeTaskExecutionRepository.findOne({
      where: { id: input.executionId },
    });

    if (!execution) {
      throw new ActiveTaskExecutionNotFoundError(input.executionId);
    }

    this.emitExecutionActivity({
      executionId: execution.id,
      taskId: execution.taskId,
      agentActorId: execution.agentActorId,
      kind: input.kind ?? 'worker.activity',
      message: input.message,
      ts: input.ts,
      runnerSessionId: input.runnerSessionId ?? null,
    });
  }

  publishSystemActivity(input: PublishSystemExecutionActivityInput): void {
    this.emitExecutionActivity({
      executionId: input.executionId,
      taskId: input.taskId,
      agentActorId: input.agentActorId,
      kind: input.kind,
      message: input.message,
      ts: input.ts,
      runnerSessionId: null,
    });
  }

  async touchHeartbeat(input: TouchExecutionHeartbeatInput): Promise<boolean> {
    return this.activeTaskExecutionRepository
      .createQueryBuilder()
      .update(ActiveTaskExecutionEntity)
      .set({
        lastHeartbeatAt: () => 'CURRENT_TIMESTAMP',
        updatedAt: () => 'CURRENT_TIMESTAMP',
        rowVersion: () => 'row_version + 1',
      })
      .where('id = :executionId', { executionId: input.executionId })
      .execute()
      .then((result) => (result.affected ?? 0) > 0);
  }

  private emitExecutionActivity(input: {
    executionId: string;
    taskId: string;
    agentActorId: string;
    kind: string;
    message?: string;
    ts?: number;
    runnerSessionId?: string | null;
  }): void {
    this.eventEmitter.emit(
      ExecutionActivityEvent.INTERNAL,
      new ExecutionActivityEvent(
        { id: input.agentActorId },
        {
          executionId: input.executionId,
          taskId: input.taskId,
          agentActorId: input.agentActorId,
          kind: input.kind,
          message: input.message,
          ts: input.ts ?? Date.now(),
          runnerSessionId: input.runnerSessionId ?? null,
        },
      ),
    );
  }
}
