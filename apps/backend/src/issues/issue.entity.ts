import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { IssueState, IssueStateReason } from './enums';
import type { IssueLabel } from './github/issue-snapshot';

/** Conditional-request tag of the GitHub resource an issue is read from. */
export type IssueEtags = {
  issue?: string;
};

/**
 * One issue on github.com or a GitHub Enterprise, however many places link to
 * it: the last known state, and when to look again. Rows are created the first
 * time a link is seen; the snapshot columns stay null until the first
 * successful fetch.
 */
@Entity({ name: 'issues' })
@Index('UQ_issues_key', ['key'], { unique: true })
export class IssueEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /**
   * `owner/repo#number` on github.com, `host/owner/repo#number` on a GitHub
   * Enterprise; lower case: GitHub owners and repositories ignore case.
   */
  @Column({ type: 'text' })
  key!: string;

  /** github.com, or the host of the GitHub Enterprise it lives on. */
  @Column({ type: 'text', default: 'github.com' })
  host!: string;

  @Column({ type: 'text' })
  owner!: string;

  @Column({ type: 'text' })
  repo!: string;

  @Column({ type: 'integer' })
  number!: number;

  @Column({ type: 'text', nullable: true })
  title!: string | null;

  @Column({ type: 'text', nullable: true, enum: IssueState })
  state!: IssueState | null;

  @Column({ type: 'text', nullable: true, name: 'state_reason', enum: IssueStateReason })
  stateReason!: IssueStateReason | null;

  /** GitHub serves pull requests as issues too: the link was an `/issues/n` link to a pull request. */
  @Column({ type: 'boolean', default: false, name: 'is_pull_request' })
  isPullRequest!: boolean;

  @Column({ type: 'text', nullable: true, name: 'author_login' })
  authorLogin!: string | null;

  @Column({ type: 'jsonb', default: () => "'[]'" })
  labels!: IssueLabel[];

  @Column({ type: 'jsonb', default: () => "'[]'" })
  assignees!: string[];

  @Column({ type: 'text', nullable: true })
  milestone!: string | null;

  @Column({ type: 'integer', nullable: true, name: 'comment_count' })
  commentCount!: number | null;

  @Column({ type: 'timestamptz', nullable: true, name: 'closed_at' })
  closedAt!: Date | null;

  /** When GitHub says the issue last changed. */
  @Column({ type: 'timestamptz', nullable: true, name: 'github_updated_at' })
  githubUpdatedAt!: Date | null;

  @Column({ type: 'jsonb', default: () => "'{}'" })
  etags!: IssueEtags;

  @Column({ type: 'timestamptz', nullable: true, name: 'last_fetched_at' })
  lastFetchedAt!: Date | null;

  /** When to look again. Null: only when someone asks (a view, a webhook, a new link). */
  @Index('IDX_issues_next_fetch_at')
  @Column({ type: 'timestamptz', nullable: true, name: 'next_fetch_at' })
  nextFetchAt!: Date | null;

  /** Why the last fetch failed; null when it worked. */
  @Column({ type: 'text', nullable: true, name: 'last_error' })
  lastError!: string | null;

  @Column({ type: 'integer', default: 0, name: 'failed_fetches' })
  failedFetches!: number;

  /** Last time someone looked at the issue in Taico. Keeps it fresh while it is on screen. */
  @Column({ type: 'timestamptz', nullable: true, name: 'last_viewed_at' })
  lastViewedAt!: Date | null;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt!: Date;
}
