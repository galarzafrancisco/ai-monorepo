import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { WorkerEntity } from './worker.entity';
import { RecordWorkerSeenInput } from './dto/service/workers.service.types';
import { WorkerSeenEvent } from './events/workers.events';

@Injectable()
export class WorkersService {
  constructor(
    @InjectRepository(WorkerEntity)
    private readonly workersRepository: Repository<WorkerEntity>,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async findAll(): Promise<WorkerEntity[]> {
    return this.workersRepository.find({
      order: {
        lastSeenAt: 'DESC',
      },
    });
  }

  async recordWorkerSeen(input: RecordWorkerSeenInput): Promise<WorkerEntity> {
    const worker = await this.workersRepository.findOne({
      where: { oauthClientId: input.oauthClientId },
    });

    const nextSeenAt = input.seenAt ?? new Date();

    let savedWorker: WorkerEntity;

    if (!worker) {
      savedWorker = await this.workersRepository.save(
        this.workersRepository.create({
          oauthClientId: input.oauthClientId,
          lastSeenAt: nextSeenAt,
          harnesses: input.harnesses ?? [],
        }),
      );
    } else {
      worker.lastSeenAt = nextSeenAt;

      if (input.harnesses) {
        worker.harnesses = input.harnesses;
      }

      savedWorker = await this.workersRepository.save(worker);
    }

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
}
