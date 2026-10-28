/** Why GitHub says an issue is in its state. Null for issues closed before GitHub recorded a reason. */
export enum IssueStateReason {
  COMPLETED = 'completed',
  NOT_PLANNED = 'not_planned',
  DUPLICATE = 'duplicate',
  REOPENED = 'reopened',
}
