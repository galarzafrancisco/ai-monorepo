import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, EntityManager, Repository } from 'typeorm';
import { ActiveTaskExecutionEntity } from '../active/active-task-execution.entity';

const DEFAULT_STALE_THRESHOLD_MS = 10 * 60 * 1000;
/**
 * How long a heartbeating worker may go unseen before its executions are
 * stale. Workers heartbeat every 30s, whatever their agent is doing.
 */
const DEFAULT_WORKER_GONE_MS = 2 * 60 * 1000;

export type FindStaleExecutionsInput = {
  now?: Date;
  staleThresholdMs?: number;
  workerGoneMs?: number;
  /** Look only at this execution. */
  executionId?: string;
  /** Read in this transaction, locking the rows found (`FOR UPDATE`). */
  manager?: EntityManager;
};

@Injectable()
export class StaleActiveTaskExecutionDetectorService {
  private readonly staleThresholdMs = resolveMs(
    'EXECUTIONS_STALENESS_THRESHOLD_MS',
    DEFAULT_STALE_THRESHOLD_MS,
  );
  private readonly workerGoneMs = resolveMs(
    'EXECUTIONS_WORKER_GONE_MS',
    DEFAULT_WORKER_GONE_MS,
  );

  constructor(
    @InjectRepository(ActiveTaskExecutionEntity)
    private readonly activeTaskExecutionRepository: Repository<ActiveTaskExecutionEntity>,
  ) {}

  /**
   * Executions that stopped making progress, either way:
   * - no execution heartbeat for `staleThresholdMs` (10 min). Agents only
   *   heartbeat on activity, and a quiet tool call can legitimately run long;
   * - their worker went quiet for `workerGoneMs` (2 min), counted from the
   *   later of its last contact and the claim, with no execution heartbeat
   *   in that time either. Only for workers that have ever sent a worker
   *   heartbeat (`last_heartbeat_at`), which proves they send them every 30s;
   *   older workers don't, and keep the first rule only.
   *
   * With `manager`, the rows are locked and the conditions are rechecked
   * against their latest version, so the pruner can confirm an execution is
   * still stale in the transaction that deletes it.
   */
  async findStaleExecutions(
    input?: FindStaleExecutionsInput,
  ): Promise<ActiveTaskExecutionEntity[]> {
    const staleThresholdMs = input?.staleThresholdMs ?? this.staleThresholdMs;
    const workerGoneMs = input?.workerGoneMs ?? this.workerGoneMs;
    const now = input?.now ?? new Date();
    const staleCutoff = new Date(now.getTime() - staleThresholdMs);
    const workerCutoff = new Date(now.getTime() - workerGoneMs);

    const query = (input?.manager ?? this.activeTaskExecutionRepository.manager)
      .createQueryBuilder(ActiveTaskExecutionEntity, 'execution')
      .where(
        new Brackets((stale) => {
          stale
            .where(
              '(execution.lastHeartbeatAt IS NOT NULL AND execution.lastHeartbeatAt <= :staleCutoff)',
              { staleCutoff },
            )
            .orWhere(
              '(execution.lastHeartbeatAt IS NULL AND execution.claimedAt <= :staleCutoff)',
              { staleCutoff },
            )
            .orWhere(
              `(execution.claimedAt <= :workerCutoff
                AND (execution.lastHeartbeatAt IS NULL OR execution.lastHeartbeatAt <= :workerCutoff)
                AND EXISTS (
                  SELECT 1 FROM workers w
                  WHERE w.workspace_id = execution.workspace_id
                    AND w.oauth_client_id = execution.worker_client_id
                    AND w.last_heartbeat_at IS NOT NULL
                    AND w.last_seen_at <= :workerCutoff
                ))`,
              { workerCutoff },
            );
        }),
      );

    if (input?.executionId) {
      query.andWhere('execution.id = :executionId', { executionId: input.executionId });
    }
    if (input?.manager) {
      query.setLock('pessimistic_write');
    }

    return query.orderBy('execution.claimedAt', 'ASC').getMany();
  }
}

function resolveMs(envName: string, fallback: number): number {
  const parsed = Number.parseInt(process.env[envName] ?? '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}
