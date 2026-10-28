import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import { PullRequestEntity } from './pull-request.entity';
import { PullRequestReferenceSource } from './enums';

/**
 * A place Taico saw a link to a pull request. `task_id` or `thread_id` says
 * which task or thread it belongs to, so a thread can list the pull requests
 * of its tasks and the poller knows which pull requests matter.
 */
@Entity({ name: 'pull_request_references' })
@Index('IDX_pull_request_references_task', ['taskId'])
@Index('IDX_pull_request_references_thread', ['threadId'])
export class PullRequestReferenceEntity {
  @PrimaryColumn({ type: 'uuid', name: 'pull_request_id' })
  pullRequestId!: string;

  @ManyToOne(() => PullRequestEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'pull_request_id' })
  pullRequest?: PullRequestEntity;

  @PrimaryColumn({ type: 'text', name: 'source_type', enum: PullRequestReferenceSource })
  sourceType!: PullRequestReferenceSource;

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
