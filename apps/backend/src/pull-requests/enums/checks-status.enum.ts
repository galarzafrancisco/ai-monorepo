/**
 * The CI of a pull request's latest commit, from its check runs and commit
 * statuses together. A failure wins over checks still running.
 */
export enum ChecksStatus {
  /** No checks reported. */
  NONE = 'none',
  PENDING = 'pending',
  SUCCESS = 'success',
  FAILURE = 'failure',
}
