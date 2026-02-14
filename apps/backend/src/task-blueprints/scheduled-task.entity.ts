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
  Index,
} from 'typeorm';
import { TaskBlueprintEntity } from './task-blueprint.entity';

/**
 * ScheduledTaskEntity represents a scheduled execution of a task blueprint.
 * It contains cron expression for scheduling and tracks execution times.
 */
@Entity({ name: 'scheduled_tasks' })
@Index('idx_scheduled_tasks_enabled_next_run_at', ['enabled', 'nextRunAt'])
@Index('idx_scheduled_tasks_task_blueprint_id', ['taskBlueprintId'])
export class ScheduledTaskEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', nullable: false, name: 'task_blueprint_id' })
  taskBlueprintId!: string;

  @ManyToOne(() => TaskBlueprintEntity)
  @JoinColumn({ name: 'task_blueprint_id' })
  taskBlueprint?: TaskBlueprintEntity;

  @Column({ type: 'text', nullable: false, name: 'cron_expression' })
  cronExpression!: string;

  @Column({ type: 'boolean', default: true })
  enabled!: boolean;

  @Column({ type: 'datetime', nullable: true, name: 'last_run_at' })
  lastRunAt!: Date | null;

  @Column({ type: 'datetime', nullable: false, name: 'next_run_at' })
  nextRunAt!: Date;

  @VersionColumn({ name: 'row_version' })
  rowVersion!: number;

  @CreateDateColumn({ type: 'datetime', name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'datetime', name: 'updated_at' })
  updatedAt!: Date;

  @DeleteDateColumn({ type: 'datetime', name: 'deleted_at', nullable: true })
  deletedAt?: Date | null;
}
