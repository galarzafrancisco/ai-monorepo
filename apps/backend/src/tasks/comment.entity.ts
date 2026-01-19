import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  VersionColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { TaskEntity } from './task.entity';
import { ActorEntity } from '../identity-provider/actor.entity';

@Entity({ name: 'comments' })
export class CommentEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', nullable: true, name: 'commenter_actor_id' })
  commenterActorId!: string | null;

  @ManyToOne(() => ActorEntity)
  @JoinColumn({ name: 'commenter_actor_id' })
  commenterActor?: ActorEntity;

  @Column({ type: 'text' })
  content!: string;

  @ManyToOne(() => TaskEntity, (task) => task.comments, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'task_id' })
  task!: TaskEntity;

  // Computed property to access task ID easily
  get taskId(): string {
    return this.task?.id;
  }

  /**
   * Commenter name from the associated actor.
   * Returns 'Unknown' as fallback if actor is not loaded.
   */
  get commenterName(): string {
    return this.commenterActor?.displayName ?? 'Unknown';
  }

  @VersionColumn({ name: 'row_version' })
  rowVersion!: number;

  @CreateDateColumn({ type: 'datetime', name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'datetime', name: 'updated_at' })
  updatedAt!: Date;

  @DeleteDateColumn({ type: 'datetime', name: 'deleted_at', nullable: true })
  deletedAt?: Date | null;
}
