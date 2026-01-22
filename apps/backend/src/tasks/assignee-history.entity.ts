import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { TaskEntity } from './task.entity';
import { ActorEntity } from '../identity-provider/actor.entity';

@Entity({ name: 'task_assignee_history' })
export class AssigneeHistoryEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'task_id' })
  taskId!: string;

  @ManyToOne(() => TaskEntity, (task) => task.assigneeHistory)
  @JoinColumn({ name: 'task_id' })
  task!: TaskEntity;

  @Column({ type: 'uuid', name: 'assignee_actor_id' })
  assigneeActorId!: string;

  @ManyToOne(() => ActorEntity)
  @JoinColumn({ name: 'assignee_actor_id' })
  assigneeActor!: ActorEntity;

  @CreateDateColumn({ type: 'datetime', name: 'assigned_at' })
  assignedAt!: Date;
}
