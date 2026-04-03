import {
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Column,
} from 'typeorm';
import { TaskEntity } from '../../tasks/task.entity';

@Entity({ name: 'active_task_executions_v2' })
export class ActiveTaskExecutionEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'task_id' })
  taskId!: string;

  @ManyToOne(() => TaskEntity)
  @JoinColumn({ name: 'task_id' })
  task?: TaskEntity;
}
