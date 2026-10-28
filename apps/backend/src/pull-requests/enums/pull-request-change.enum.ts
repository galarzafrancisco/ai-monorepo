/** Something that happened to a pull request between two looks at it. */
export enum PullRequestChange {
  MERGED = 'merged',
  CLOSED = 'closed',
  REOPENED = 'reopened',
  READY_FOR_REVIEW = 'ready_for_review',
  CONVERTED_TO_DRAFT = 'converted_to_draft',
  NEW_COMMITS = 'new_commits',
  CHECKS_STARTED = 'checks_started',
  CHECKS_PASSED = 'checks_passed',
  CHECKS_FAILED = 'checks_failed',
  APPROVED = 'approved',
  CHANGES_REQUESTED = 'changes_requested',
  NEW_COMMENTS = 'new_comments',
}
