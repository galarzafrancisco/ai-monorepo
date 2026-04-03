import {
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  JoinColumn,
  OneToOne,
  PrimaryColumn,
  UpdateDateColumn,
  VersionColumn,
} from 'typeorm';
import { TaskEntity } from '../../tasks/task.entity';

@Entity({ name: 'task_execution_queue' })
export class TaskExecutionQueueEntity {
  @PrimaryColumn({ type: 'uuid', name: 'task_id' })
  taskId!: string;

  @OneToOne(() => TaskEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'task_id' })
  task?: TaskEntity;

  @VersionColumn({ name: 'row_version' })
  rowVersion!: number;

  @CreateDateColumn({ type: 'datetime', name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'datetime', name: 'updated_at' })
  updatedAt!: Date;

  @DeleteDateColumn({ type: 'datetime', name: 'deleted_at', nullable: true })
  deletedAt?: Date | null;
}
