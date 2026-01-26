import { FeedEventType } from '../../feed-item.entity';
import { ActorResult } from '../../../tasks/dto/service/tasks.service.types';

export interface FeedItemResult {
  id: string;
  eventType: FeedEventType;
  taskId: string;
  taskName: string;
  actor: ActorResult;
  metadata?: Record<string, any>;
  createdAt: Date;
}

export interface ListFeedInput {
  taskId?: string;
  page: number;
  limit: number;
}

export interface ListFeedResult {
  items: FeedItemResult[];
  total: number;
  page: number;
  limit: number;
}
