import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ActiveTaskExecutionEntity } from '../active/active-task-execution.entity';

const DEFAULT_STALE_THRESHOLD_MS = 10 * 60 * 1000;

export type FindStaleExecutionsInput = {
  now?: Date;
  staleThresholdMs?: number;
};

@Injectable()
export class StaleActiveTaskExecutionDetectorService {
  private readonly staleThresholdMs =
    StaleActiveTaskExecutionDetectorService.resolveStaleThresholdMs();

  constructor(
    @InjectRepository(ActiveTaskExecutionEntity)
    private readonly activeTaskExecutionRepository: Repository<ActiveTaskExecutionEntity>,
  ) {}

  async findStaleExecutions(
    input?: FindStaleExecutionsInput,
  ): Promise<ActiveTaskExecutionEntity[]> {
    const staleThresholdMs =
      input?.staleThresholdMs ?? this.staleThresholdMs;
    const now = input?.now ?? new Date();
    const staleCutoff = new Date(now.getTime() - staleThresholdMs);

    return this.activeTaskExecutionRepository
      .createQueryBuilder('execution')
      .where(
        '(execution.lastHeartbeatAt IS NOT NULL AND execution.lastHeartbeatAt <= :staleCutoff)',
        { staleCutoff },
      )
      .orWhere(
        '(execution.lastHeartbeatAt IS NULL AND execution.claimedAt <= :staleCutoff)',
        { staleCutoff },
      )
      .orderBy('execution.claimedAt', 'ASC')
      .getMany();
  }

  private static resolveStaleThresholdMs(): number {
    const rawValue = process.env.EXECUTIONS_STALENESS_THRESHOLD_MS;
    const parsedValue = Number.parseInt(rawValue ?? '', 10);

    if (!Number.isFinite(parsedValue) || parsedValue <= 0) {
      return DEFAULT_STALE_THRESHOLD_MS;
    }

    return parsedValue;
  }
}
