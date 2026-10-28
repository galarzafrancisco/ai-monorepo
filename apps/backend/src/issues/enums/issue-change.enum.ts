/** Something that happened to an issue between two looks at it. */
export enum IssueChange {
  CLOSED = 'closed',
  REOPENED = 'reopened',
  ASSIGNED = 'assigned',
  LABELED = 'labeled',
  NEW_COMMENTS = 'new_comments',
}
