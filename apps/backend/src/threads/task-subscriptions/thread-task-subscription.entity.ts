import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
} from 'typeorm';
import { ActorEntity } from '../../identity-provider/actor.entity';
import { TaskEntity } from '../../tasks/task.entity';
import { TaskStatus } from '../../tasks/enums';
import { ThreadEntity } from '../thread.entity';

/**
 * A thread waiting to hear about a task: the threads agent is told when the
 * task goes to review or is done.
 *
 * The `triggered*` columns are set when that happens and hold what the agent
 * will be told. The next agent turn delivers the notification, then clears the
 * columns (review) or removes the row (done).
 */
@Entity({ name: 'thread_task_subscriptions' })
export class ThreadTaskSubscriptionEntity {
  @PrimaryColumn({ type: 'uuid', name: 'thread_id' })
  threadId!: string;

  @Index('IDX_thread_task_subscriptions_task')
  @PrimaryColumn({ type: 'uuid', name: 'task_id' })
  taskId!: string;

  @ManyToOne(() => ThreadEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'thread_id' })
  thread?: ThreadEntity;

  @ManyToOne(() => TaskEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'task_id' })
  task?: TaskEntity;

  /** Who the agent was answering when it subscribed; the notification turn acts on their behalf. */
  @Column({ type: 'uuid', name: 'subscribed_for_actor_id' })
  subscribedForActorId!: string;

  @ManyToOne(() => ActorEntity)
  @JoinColumn({ name: 'subscribed_for_actor_id' })
  subscribedForActor?: ActorEntity;

  /** What the user wants from the task, in the agent's words. Repeated back in the notification. */
  @Column({ type: 'text', nullable: true, name: 'waiting_for' })
  waitingFor!: string | null;

  @Column({ type: 'text', nullable: true, name: 'triggered_status' })
  triggeredStatus!: TaskStatus | null;

  /** Kept here because a finished task can be deleted before the agent is told. */
  @Column({ type: 'text', nullable: true, name: 'triggered_task_name' })
  triggeredTaskName!: string | null;

  @Column({ type: 'timestamptz', nullable: true, name: 'triggered_at' })
  triggeredAt!: Date | null;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;
}
