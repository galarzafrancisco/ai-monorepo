import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { OnEvent } from '@nestjs/event-emitter';
import { Repository } from 'typeorm';
import { FeedItemEntity, FeedEventType } from './feed-item.entity';
import {
  TaskCreatedEvent,
  TaskUpdatedEvent,
  TaskAssignedEvent,
  TaskStatusChangedEvent,
  TaskDeletedEvent,
  CommentAddedEvent,
} from '../tasks/events/tasks.events';
import { ListFeedInput, ListFeedResult, FeedItemResult } from './dto/service/feed.service.types';
import { ActorResult } from '../tasks/dto/service/tasks.service.types';

@Injectable()
export class FeedService {
  private readonly logger = new Logger(FeedService.name);

  constructor(
    @InjectRepository(FeedItemEntity)
    private readonly feedItemRepository: Repository<FeedItemEntity>,
  ) {}

  @OnEvent('task.created')
  async handleTaskCreated(event: TaskCreatedEvent): Promise<void> {
    this.logger.log({
      message: 'Handling task.created event',
      taskId: event.payload.id,
    });

    await this.createFeedItem({
      eventType: FeedEventType.TASK_CREATED,
      taskId: event.payload.id,
      actorId: event.actor.id,
      metadata: {
        taskName: event.payload.name,
      },
    });
  }

  @OnEvent('task.updated')
  async handleTaskUpdated(event: TaskUpdatedEvent): Promise<void> {
    this.logger.log({
      message: 'Handling task.updated event',
      taskId: event.payload.id,
    });

    await this.createFeedItem({
      eventType: FeedEventType.TASK_UPDATED,
      taskId: event.payload.id,
      actorId: event.actor.id,
      metadata: {
        taskName: event.payload.name,
      },
    });
  }

  @OnEvent('task.assigned')
  async handleTaskAssigned(event: TaskAssignedEvent): Promise<void> {
    this.logger.log({
      message: 'Handling task.assigned event',
      taskId: event.payload.id,
      assigneeActorId: event.payload.assigneeActorId,
    });

    await this.createFeedItem({
      eventType: FeedEventType.TASK_ASSIGNED,
      taskId: event.payload.id,
      actorId: event.actor.id,
      metadata: {
        taskName: event.payload.name,
        assigneeActorId: event.payload.assigneeActorId,
        assignee: event.payload.assignee,
      },
    });
  }

  @OnEvent('task.statusChanged')
  async handleTaskStatusChanged(event: TaskStatusChangedEvent): Promise<void> {
    this.logger.log({
      message: 'Handling task.statusChanged event',
      taskId: event.payload.id,
      status: event.payload.status,
    });

    await this.createFeedItem({
      eventType: FeedEventType.TASK_STATUS_CHANGED,
      taskId: event.payload.id,
      actorId: event.actor.id,
      metadata: {
        taskName: event.payload.name,
        status: event.payload.status,
      },
    });
  }

  @OnEvent('task.deleted')
  async handleTaskDeleted(event: TaskDeletedEvent): Promise<void> {
    this.logger.log({
      message: 'Handling task.deleted event',
      taskId: event.taskId,
    });

    await this.createFeedItem({
      eventType: FeedEventType.TASK_DELETED,
      taskId: event.taskId,
      actorId: event.actor.id,
      metadata: {},
    });
  }

  @OnEvent('comment.added')
  async handleCommentAdded(event: CommentAddedEvent): Promise<void> {
    this.logger.log({
      message: 'Handling comment.added event',
      taskId: event.payload.taskId,
      commentId: event.payload.id,
    });

    await this.createFeedItem({
      eventType: FeedEventType.COMMENT_ADDED,
      taskId: event.payload.taskId,
      actorId: event.actor.id,
      metadata: {
        taskName: event.payload.task?.name,
        commentContent: event.payload.content.substring(0, 100), // First 100 chars
      },
    });
  }

  private async createFeedItem(data: {
    eventType: FeedEventType;
    taskId: string;
    actorId: string;
    metadata: Record<string, any>;
  }): Promise<void> {
    const feedItem = this.feedItemRepository.create({
      eventType: data.eventType,
      taskId: data.taskId,
      actorId: data.actorId,
      metadata: JSON.stringify(data.metadata),
    });

    await this.feedItemRepository.save(feedItem);

    this.logger.log({
      message: 'Feed item created',
      feedItemId: feedItem.id,
      eventType: data.eventType,
      taskId: data.taskId,
    });
  }

  async listFeed(input: ListFeedInput): Promise<ListFeedResult> {
    this.logger.log({
      message: 'Listing feed items',
      taskId: input.taskId,
      page: input.page,
      limit: input.limit,
    });

    const skip = (input.page - 1) * input.limit;

    const queryBuilder = this.feedItemRepository
      .createQueryBuilder('feedItem')
      .leftJoinAndSelect('feedItem.actor', 'actor')
      .leftJoinAndSelect('feedItem.task', 'task');

    if (input.taskId) {
      queryBuilder.where('feedItem.taskId = :taskId', { taskId: input.taskId });
    }

    queryBuilder
      .orderBy('feedItem.createdAt', 'DESC')
      .skip(skip)
      .take(input.limit);

    const [items, total] = await queryBuilder.getManyAndCount();

    this.logger.log({
      message: 'Feed items listed',
      count: items.length,
      total,
      page: input.page,
    });

    return {
      items: items.map((item) => this.mapFeedItemToResult(item)),
      total,
      page: input.page,
      limit: input.limit,
    };
  }

  private mapFeedItemToResult(item: FeedItemEntity): FeedItemResult {
    let metadata: Record<string, any> = {};
    try {
      metadata = item.metadata ? JSON.parse(item.metadata) : {};
    } catch (e) {
      this.logger.warn({
        message: 'Failed to parse feed item metadata',
        feedItemId: item.id,
        error: e,
      });
    }

    return {
      id: item.id,
      eventType: item.eventType,
      taskId: item.taskId,
      taskName: item.task?.name ?? metadata.taskName ?? 'Unknown Task',
      actor: {
        id: item.actor!.id,
        type: item.actor!.type,
        slug: item.actor!.slug,
        displayName: item.actor!.displayName,
        avatarUrl: item.actor!.avatarUrl,
      },
      metadata,
      createdAt: item.createdAt,
    };
  }
}
