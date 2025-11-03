import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { Comment } from './comment.entity';

export enum TaskStatus {
  NOT_STARTED = 'not started',
  IN_PROGRESS = 'in progress',
  FOR_REVIEW = 'for review',
  DONE = 'done',
}

@Entity()
export class Task {
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

  @Column({ type: 'text', nullable: true })
  assignee!: string | null;

  @Column({ type: 'text', nullable: true })
  sessionId!: string | null;

  @OneToMany(() => Comment, (comment) => comment.task, { cascade: true })
  comments!: Comment[];

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
