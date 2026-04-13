import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { WorkerEntity } from './worker.entity';
import { RecordWorkerSeenInput } from './dto/service/workers.service.types';

@Injectable()
export class WorkersService {
  constructor(
    @InjectRepository(WorkerEntity)
    private readonly workersRepository: Repository<WorkerEntity>,
  ) {}

  async recordWorkerSeen(input: RecordWorkerSeenInput): Promise<WorkerEntity> {
    const worker = await this.workersRepository.findOne({
      where: { oauthClientId: input.oauthClientId },
    });

    const nextSeenAt = input.seenAt ?? new Date();

    if (!worker) {
      return this.workersRepository.save(
        this.workersRepository.create({
          oauthClientId: input.oauthClientId,
          lastSeenAt: nextSeenAt,
          harnesses: input.harnesses ?? [],
        }),
      );
    }

    worker.lastSeenAt = nextSeenAt;

    if (input.harnesses) {
      worker.harnesses = input.harnesses;
    }

    return this.workersRepository.save(worker);
  }
}
