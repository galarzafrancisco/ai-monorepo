/** Where a pull request is in its life. A draft is an open pull request with `draft` set. */
export enum PullRequestState {
  OPEN = 'open',
  CLOSED = 'closed',
  MERGED = 'merged',
}
