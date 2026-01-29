import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  VersionColumn,
  OneToMany,
  ManyToMany,
  ManyToOne,
  JoinTable,
  JoinColumn,
} from 'typeorm';
import { CommentEntity } from './comment.entity';
import { InputRequestEntity } from './input-request.entity';
import { TagEntity } from '../meta/tag.entity';
import { TaskStatus } from './enums';
import { ActorEntity } from '../identity-provider/actor.entity';

@Entity({ name: 'tasks' })
export class TaskEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  name!: string;

  @Column('text')
  description!: string;

  @Column({
    type: 'text',
    enum: TaskStatus,
    default: TaskStatus.NOT_STARTED,
  })
  status!: TaskStatus;

  @Column({ type: 'uuid', nullable: true, name: 'assignee_actor_id' })
  assigneeActorId!: string | null;

  @ManyToOne(() => ActorEntity)
  @JoinColumn({ name: 'assignee_actor_id' })
  assigneeActor?: ActorEntity;

  @Column({ type: 'text', nullable: true, name: 'session_id' })
  sessionId!: string | null;

  @Column({ type: 'uuid', nullable: false, name: 'created_by_actor_id' })
  createdByActorId!: string;

  @ManyToOne(() => ActorEntity)
  @JoinColumn({ name: 'created_by_actor_id' })
  createdByActor?: ActorEntity;

  @ManyToMany(() => TaskEntity, (task) => task.dependents)
  @JoinTable({
    name: 'task_dependencies',
    joinColumn: { name: 'task_id' },
    inverseJoinColumn: { name: 'depends_on_task_id' },
  })
  dependsOn!: TaskEntity[];

  @ManyToMany(() => TaskEntity, (task) => task.dependsOn)
  dependents!: TaskEntity[];

  @OneToMany(() => CommentEntity, (comment) => comment.task, { cascade: true })
  comments!: CommentEntity[];

  @OneToMany(() => InputRequestEntity, (inputRequest) => inputRequest.task, {
    cascade: true,
  })
  inputRequests!: InputRequestEntity[];

  @ManyToMany(() => TagEntity, (tag) => tag.tasks)
  @JoinTable({
    name: 'task_tags',
    joinColumn: { name: 'task_id' },
    inverseJoinColumn: { name: 'tag_id' },
  })
  tags!: TagEntity[];

  @VersionColumn({ name: 'row_version' })
  rowVersion!: number;

  @CreateDateColumn({ type: 'datetime', name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'datetime', name: 'updated_at' })
  updatedAt!: Date;

  @DeleteDateColumn({ type: 'datetime', name: 'deleted_at', nullable: true })
  deletedAt?: Date | null;

  /**
   * Assignee slug from the associated actor.
   * Returns null if no assignee or actor not loaded.
   */
  get assignee(): string | null {
    return this.assigneeActor?.slug ?? null;
  }
}
