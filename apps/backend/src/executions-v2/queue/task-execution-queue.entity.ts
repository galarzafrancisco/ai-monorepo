import { Entity, JoinColumn, OneToOne, PrimaryColumn } from 'typeorm';
import { TaskEntity } from '../../tasks/task.entity';

@Entity({ name: 'task_execution_queue' })
export class TaskExecutionQueueEntity {
  @PrimaryColumn({ type: 'uuid', name: 'task_id' })
  taskId!: string;

  @OneToOne(() => TaskEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'task_id' })
  task?: TaskEntity;
}
