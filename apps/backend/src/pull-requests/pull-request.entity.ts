import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { ChecksStatus, PullRequestState, ReviewDecision } from './enums';

/** Conditional-request tags of the GitHub resources a pull request is read from. */
export type PullRequestEtags = {
  pull?: string;
  reviews?: string;
  /** Check runs and statuses belong to a commit; their tags are only valid for `sha`. */
  sha?: string;
  checkRuns?: string;
  statuses?: string;
};

/**
 * One pull request on github.com or a GitHub Enterprise, however many places link to it: the last known
 * state, and when to look again. Rows are created the first time a link is
 * seen; the snapshot columns stay null until the first successful fetch.
 */
@Entity({ name: 'pull_requests' })
@Index('UQ_pull_requests_key', ['key'], { unique: true })
export class PullRequestEntity {
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

  @Column({ type: 'text', nullable: true, enum: PullRequestState })
  state!: PullRequestState | null;

  @Column({ type: 'boolean', default: false })
  draft!: boolean;

  @Column({ type: 'text', nullable: true, name: 'author_login' })
  authorLogin!: string | null;

  @Column({ type: 'text', nullable: true, name: 'head_sha' })
  headSha!: string | null;

  @Column({ type: 'text', nullable: true, name: 'head_ref' })
  headRef!: string | null;

  @Column({ type: 'text', nullable: true, name: 'base_ref' })
  baseRef!: string | null;

  @Column({ type: 'integer', nullable: true })
  additions!: number | null;

  @Column({ type: 'integer', nullable: true })
  deletions!: number | null;

  @Column({ type: 'integer', nullable: true, name: 'changed_files' })
  changedFiles!: number | null;

  /** Conversation comments plus review comments. */
  @Column({ type: 'integer', nullable: true, name: 'comment_count' })
  commentCount!: number | null;

  @Column({ type: 'text', default: ChecksStatus.NONE, name: 'checks_status', enum: ChecksStatus })
  checksStatus!: ChecksStatus;

  @Column({ type: 'integer', default: 0, name: 'checks_total' })
  checksTotal!: number;

  @Column({ type: 'integer', default: 0, name: 'checks_passed' })
  checksPassed!: number;

  @Column({ type: 'integer', default: 0, name: 'checks_failed' })
  checksFailed!: number;

  @Column({ type: 'integer', default: 0, name: 'checks_pending' })
  checksPending!: number;

  /** Names of the failing checks, for the agent and the hover card. */
  @Column({ type: 'jsonb', default: () => "'[]'", name: 'failed_checks' })
  failedChecks!: string[];

  @Column({ type: 'text', default: ReviewDecision.NONE, name: 'review_decision', enum: ReviewDecision })
  reviewDecision!: ReviewDecision;

  @Column({ type: 'integer', default: 0 })
  approvals!: number;

  @Column({ type: 'timestamptz', nullable: true, name: 'merged_at' })
  mergedAt!: Date | null;

  @Column({ type: 'timestamptz', nullable: true, name: 'closed_at' })
  closedAt!: Date | null;

  /** When GitHub says the pull request last changed. */
  @Column({ type: 'timestamptz', nullable: true, name: 'github_updated_at' })
  githubUpdatedAt!: Date | null;

  @Column({ type: 'jsonb', default: () => "'{}'" })
  etags!: PullRequestEtags;

  @Column({ type: 'timestamptz', nullable: true, name: 'last_fetched_at' })
  lastFetchedAt!: Date | null;

  /** When to look again. Null: only when someone asks (a view, a webhook, a new link or watch). */
  @Index('IDX_pull_requests_next_fetch_at')
  @Column({ type: 'timestamptz', nullable: true, name: 'next_fetch_at' })
  nextFetchAt!: Date | null;

  /** Why the last fetch failed; null when it worked. */
  @Column({ type: 'text', nullable: true, name: 'last_error' })
  lastError!: string | null;

  @Column({ type: 'integer', default: 0, name: 'failed_fetches' })
  failedFetches!: number;

  /** Last time someone looked at the pull request in Taico. Keeps it fresh while it is on screen. */
  @Column({ type: 'timestamptz', nullable: true, name: 'last_viewed_at' })
  lastViewedAt!: Date | null;

  /** Until when something (a thread) is waiting on it. Keeps it polled often. */
  @Column({ type: 'timestamptz', nullable: true, name: 'watched_until' })
  watchedUntil!: Date | null;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt!: Date;
}
