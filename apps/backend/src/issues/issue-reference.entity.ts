import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import { IssueEntity } from './issue.entity';
import { IssueReferenceSource } from './enums';

/**
 * A place Taico saw a link to an issue. `task_id` or `thread_id` says which
 * task or thread it belongs to, so a thread can list the issues of its tasks
 * and the poller knows which issues matter.
 */
@Entity({ name: 'issue_references' })
@Index('IDX_issue_references_task', ['taskId'])
@Index('IDX_issue_references_thread', ['threadId'])
export class IssueReferenceEntity {
  @PrimaryColumn({ type: 'uuid', name: 'issue_id' })
  issueId!: string;

  @ManyToOne(() => IssueEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'issue_id' })
  issue?: IssueEntity;

  @PrimaryColumn({ type: 'text', name: 'source_type', enum: IssueReferenceSource })
  sourceType!: IssueReferenceSource;

  /** The artefact, task, comment or thread message holding the link. */
  @PrimaryColumn({ type: 'uuid', name: 'source_id' })
  sourceId!: string;

  @Column({ type: 'uuid', nullable: true, name: 'task_id' })
  taskId!: string | null;

  @Column({ type: 'uuid', nullable: true, name: 'thread_id' })
  threadId!: string | null;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;
}
