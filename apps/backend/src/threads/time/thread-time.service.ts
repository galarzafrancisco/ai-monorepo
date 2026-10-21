import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ActorType } from '../../identity-provider/enums';
import { ThreadMessageEntity } from '../thread-message.entity';
import { buildTimeContext, LatestUserMessage, TimeContext } from './time-context';

/**
 * Time context for the threads agent's `get_time` tool. It is only read when
 * the agent asks, so it never sits in the routine turn context.
 */
@Injectable()
export class ThreadTimeService {
  constructor(
    @InjectRepository(ThreadMessageEntity)
    private readonly messages: Repository<ThreadMessageEntity>,
  ) {}

  async getTimeContext(threadId: string, now: Date = new Date()): Promise<TimeContext> {
    return buildTimeContext(now, await this.findLatestUserMessage(threadId));
  }

  /** The newest message a person (not an agent) wrote in the thread. */
  async findLatestUserMessage(threadId: string): Promise<LatestUserMessage | null> {
    const message = await this.messages
      .createQueryBuilder('message')
      .innerJoin('message.createdByActor', 'actor')
      .where('message.thread_id = :threadId', { threadId })
      .andWhere('actor.type = :type', { type: ActorType.HUMAN })
      .orderBy('message.created_at', 'DESC')
      .addOrderBy('message.id', 'DESC')
      .getOne();

    if (!message) {
      return null;
    }
    return { createdAt: message.createdAt, timezone: message.timezone };
  }
}
