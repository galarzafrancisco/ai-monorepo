import {
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  VersionColumn,
} from 'typeorm';
import { AgentEntity } from '../../agents/agent.entity';
import { TaskEntity } from '../../tasks/task.entity';
import { TaskStatus } from '../../tasks/enums';

export type ActiveTaskExecutionTagSnapshot = {
  id: string;
  name: string;
};

@Entity({ name: 'active_task_executions_v2' })
export class ActiveTaskExecutionEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'task_id', unique: true })
  taskId!: string;

  @ManyToOne(() => TaskEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'task_id' })
  task?: TaskEntity;

  @Column({ type: 'datetime', name: 'claimed_at' })
  claimedAt!: Date;

  @Column({
    type: 'text',
    name: 'task_status_before_claim',
    enum: TaskStatus,
  })
  taskStatusBeforeClaim!: TaskStatus;

  @Column({ type: 'simple-json', name: 'task_tags_before_claim' })
  taskTagsBeforeClaim!: ActiveTaskExecutionTagSnapshot[];

  @Column({
    type: 'uuid',
    name: 'task_assignee_actor_id_before_claim',
    nullable: true,
  })
  taskAssigneeActorIdBeforeClaim!: string | null;

  @Column({ type: 'uuid', name: 'agent_actor_id' })
  agentActorId!: string;

  @ManyToOne(() => AgentEntity)
  @JoinColumn({ name: 'agent_actor_id', referencedColumnName: 'actorId' })
  agent?: AgentEntity;

  @Column({ type: 'text', name: 'worker_client_id' })
  workerClientId!: string;

  @VersionColumn({ name: 'row_version' })
  rowVersion!: number;

  @CreateDateColumn({ type: 'datetime', name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'datetime', name: 'updated_at' })
  updatedAt!: Date;

  @DeleteDateColumn({ type: 'datetime', name: 'deleted_at', nullable: true })
  deletedAt?: Date | null;
}
