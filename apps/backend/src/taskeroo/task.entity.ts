import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  VersionColumn,
  OneToMany,
} from 'typeorm';
import { CommentEntity } from './comment.entity';
import { TaskStatus } from './enums';

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

  @Column({ type: 'text', nullable: true, name: 'assignee' })
  assignee!: string | null;

  @Column({ type: 'text', nullable: true, name: 'session_id' })
  sessionId!: string | null;

  @OneToMany(() => CommentEntity, (comment) => comment.task, { cascade: true })
  comments!: CommentEntity[];

  @VersionColumn({ name: 'row_version' })
  rowVersion!: number;

  @CreateDateColumn({ type: 'datetime', name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'datetime', name: 'updated_at' })
  updatedAt!: Date;

  @DeleteDateColumn({ type: 'datetime', name: 'deleted_at', nullable: true })
  deletedAt?: Date | null;
}
