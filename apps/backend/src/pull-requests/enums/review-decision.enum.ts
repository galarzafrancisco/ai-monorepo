/** What the latest review of each reviewer adds up to. */
export enum ReviewDecision {
  /** Nobody has approved or asked for changes. */
  NONE = 'none',
  APPROVED = 'approved',
  CHANGES_REQUESTED = 'changes_requested',
}
