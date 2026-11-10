import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { WorkerEntity } from './worker.entity';
import {
  RecordWorkerSeenInput,
  WorkerResult,
} from './dto/service/workers.service.types';
import { WorkerSeenEvent } from './events/workers.events';

@Injectable()
export class WorkersService {
  constructor(
    @InjectRepository(WorkerEntity)
    private readonly workersRepository: Repository<WorkerEntity>,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /** The workers registered in a workspace. */
  async findAll(workspaceId: string): Promise<WorkerResult[]> {
    const workers = await this.workersRepository.find({
      where: { workspaceId },
      order: {
        lastSeenAt: 'DESC',
      },
    });

    return workers.map((worker) => this.mapWorkerToResult(worker));
  }

  /**
   * Records a worker in the workspace of the token it connected with. The
   * same OAuth client connecting with another workspace's token is another
   * worker row: a worker never moves between workspaces.
   */
  async recordWorkerSeen(
    workspaceId: string,
    input: RecordWorkerSeenInput,
  ): Promise<WorkerEntity> {
    // Upsert only supplied fields: a heartbeat must never write back a stale
    // capability report read before another socket message updated it.
    const seenAt = input.seenAt ?? new Date();
    await this.workersRepository.upsert(
      {
        workspaceId,
        oauthClientId: input.oauthClientId,
        lastSeenAt: seenAt,
        ...(input.heartbeat && { lastHeartbeatAt: seenAt }),
        ...(input.workerVersion !== undefined && {
          workerVersion: normalizeWorkerVersion(input.workerVersion),
        }),
        ...(input.harnesses !== undefined && { harnesses: input.harnesses }),
        ...(input.capabilities !== undefined && { capabilities: input.capabilities }),
      },
      { conflictPaths: ['workspaceId', 'oauthClientId'] },
    );
    const savedWorker = await this.workersRepository.findOneByOrFail({
      workspaceId,
      oauthClientId: input.oauthClientId,
    });

    // Emit event for realtime updates
    this.eventEmitter.emit(
      WorkerSeenEvent.INTERNAL,
      new WorkerSeenEvent(
        { id: savedWorker.oauthClientId },
        savedWorker,
      ),
    );

    return savedWorker;
  }

  private mapWorkerToResult(worker: WorkerEntity): WorkerResult {
    return {
      id: worker.id,
      oauthClientId: worker.oauthClientId,
      workerVersion: worker.workerVersion,
      lastSeenAt: worker.lastSeenAt,
      harnesses: worker.harnesses,
      capabilities: worker.capabilities,
      createdAt: worker.createdAt,
      updatedAt: worker.updatedAt,
    };
  }
}

function normalizeWorkerVersion(workerVersion: string | null | undefined): string | null {
  const normalized = workerVersion?.trim();
  return normalized ? normalized.slice(0, 100) : null;
}
