import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, IsNull, Repository } from 'typeorm';
import { OutboxEventEntity } from './outbox-event.entity';

const LEASE_DURATION_MS = 30_000;
const MAX_EVENTS_PER_TICK = 25;

@Injectable()
export class OutboxDispatcherService {
  private readonly logger = new Logger(OutboxDispatcherService.name);
  private isDispatching = false;

  constructor(
    @InjectRepository(OutboxEventEntity)
    private readonly outboxRepository: Repository<OutboxEventEntity>,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  @Cron(CronExpression.EVERY_SECOND)
  async dispatchAvailableEvents(): Promise<void> {
    if (this.isDispatching) {
      return;
    }

    this.isDispatching = true;
    try {
      for (let index = 0; index < MAX_EVENTS_PER_TICK; index += 1) {
        const event = await this.claimNextEvent();
        if (!event) {
          return;
        }
        await this.dispatchClaimedEvent(event);
      }
    } finally {
      this.isDispatching = false;
    }
  }

  private async claimNextEvent(): Promise<OutboxEventEntity | null> {
    const now = new Date();
    const leaseExpiredAt = new Date(now.getTime() - LEASE_DURATION_MS);
    const candidate = await this.outboxRepository
      .createQueryBuilder('event')
      .where('event.processed_at IS NULL')
      .andWhere('event.available_at <= :now', { now })
      .andWhere(
        new Brackets((query) => {
          query
            .where('event.processing_started_at IS NULL')
            .orWhere('event.processing_started_at < :leaseExpiredAt', {
              leaseExpiredAt,
            });
        }),
      )
      .orderBy('event.occurred_at', 'ASC')
      .addOrderBy('event.id', 'ASC')
      .getOne();

    if (!candidate) {
      return null;
    }

    const claim = await this.outboxRepository
      .createQueryBuilder()
      .update(OutboxEventEntity)
      .set({
        processingStartedAt: now,
        attempts: () => 'attempts + 1',
      })
      .where('id = :id', { id: candidate.id })
      .andWhere('processed_at IS NULL')
      .andWhere(
        '(processing_started_at IS NULL OR processing_started_at < :leaseExpiredAt)',
        { leaseExpiredAt },
      )
      .execute();

    if ((claim.affected ?? 0) === 0) {
      return null;
    }

    return this.outboxRepository.findOne({ where: { id: candidate.id } });
  }

  private async dispatchClaimedEvent(event: OutboxEventEntity): Promise<void> {
    try {
      const handlerResults = await this.eventEmitter.emitAsync(
        event.type,
        event,
      );
      if (handlerResults.length === 0) {
        throw new Error(`No outbox handler is registered for ${event.type}`);
      }
      await this.outboxRepository.update(
        { id: event.id, processedAt: IsNull() },
        {
          processedAt: new Date(),
          processingStartedAt: null,
          lastError: null,
        },
      );
    } catch (error) {
      const retryDelayMs = Math.min(60_000, 1_000 * 2 ** event.attempts);
      const availableAt = new Date(Date.now() + retryDelayMs);
      const message = error instanceof Error ? error.message : String(error);
      await this.outboxRepository.update(
        { id: event.id, processedAt: IsNull() },
        {
          processingStartedAt: null,
          availableAt,
          lastError: message.slice(0, 2_000),
        },
      );
      this.logger.error({
        message: 'Outbox event dispatch failed',
        outboxEventId: event.id,
        type: event.type,
        attempts: event.attempts,
        error: message,
      });
    }
  }
}
