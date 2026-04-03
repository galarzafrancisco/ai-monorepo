import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { TaskEntity } from '../../tasks/task.entity';

@Entity({ name: 'task_execution_history_v2' })
export class TaskExecutionHistoryEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'task_id' })
  taskId!: string;

  @ManyToOne(() => TaskEntity)
  @JoinColumn({ name: 'task_id' })
  task?: TaskEntity;
}
