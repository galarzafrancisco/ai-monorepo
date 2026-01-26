import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { TaskEntity } from '../tasks/task.entity';
import { ActorEntity } from '../identity-provider/actor.entity';

export enum FeedEventType {
  TASK_CREATED = 'TASK_CREATED',
  TASK_UPDATED = 'TASK_UPDATED',
  TASK_ASSIGNED = 'TASK_ASSIGNED',
  TASK_STATUS_CHANGED = 'TASK_STATUS_CHANGED',
  TASK_DELETED = 'TASK_DELETED',
  COMMENT_ADDED = 'COMMENT_ADDED',
}

@Entity({ name: 'feed_items' })
@Index(['createdAt'])
@Index(['taskId'])
export class FeedItemEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({
    type: 'text',
    enum: FeedEventType,
  })
  eventType!: FeedEventType;

  @Column({ type: 'uuid', name: 'task_id' })
  taskId!: string;

  @ManyToOne(() => TaskEntity)
  @JoinColumn({ name: 'task_id' })
  task?: TaskEntity;

  @Column({ type: 'uuid', name: 'actor_id' })
  actorId!: string;

  @ManyToOne(() => ActorEntity)
  @JoinColumn({ name: 'actor_id' })
  actor?: ActorEntity;

  @Column({ type: 'text', nullable: true })
  metadata?: string; // JSON string for additional event-specific data

  @CreateDateColumn({ type: 'datetime', name: 'created_at' })
  createdAt!: Date;
}
