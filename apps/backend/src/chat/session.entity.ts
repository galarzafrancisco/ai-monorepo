import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  VersionColumn,
  ManyToMany,
  JoinTable,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { TaskEntity } from '../taskeroo/task.entity';
import { AgentEntity } from '../agents/agent.entity';

@Entity({ name: 'chat_sessions' })
export class SessionEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'text', name: 'adk_session_id' })
  adkSessionId!: string;

  @Column({ type: 'text', name: 'agent_id' })
  agentId!: string;

  @ManyToOne(() => AgentEntity)
  @JoinColumn({ name: 'agent_id' })
  agent!: AgentEntity;

  @Column({ type: 'text' })
  title!: string;

  @Column({ type: 'text', nullable: true })
  project!: string | null;

  @Column({ type: 'boolean', name: 'is_archived', default: false })
  isArchived!: boolean;

  @Column({ type: 'boolean', name: 'is_pinned', default: false })
  isPinned!: boolean;

  @Column({ type: 'datetime', name: 'last_message_at' })
  lastMessageAt!: Date;

  @ManyToMany(() => TaskEntity)
  @JoinTable({
    name: 'chat_session_referenced_tasks',
    joinColumn: { name: 'session_id' },
    inverseJoinColumn: { name: 'task_id' },
  })
  referencedTasks!: TaskEntity[];

  @ManyToMany(() => TaskEntity)
  @JoinTable({
    name: 'chat_session_subscribed_tasks',
    joinColumn: { name: 'session_id' },
    inverseJoinColumn: { name: 'task_id' },
  })
  subscribedTasks!: TaskEntity[];

  @VersionColumn({ name: 'row_version' })
  rowVersion!: number;

  @CreateDateColumn({ type: 'datetime', name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'datetime', name: 'updated_at' })
  updatedAt!: Date;

  @DeleteDateColumn({ type: 'datetime', name: 'deleted_at', nullable: true })
  deletedAt?: Date | null;
}
