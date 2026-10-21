export enum ThreadTimerKind {
  /** Fires once. */
  REMINDER = 'reminder',
  /** Fires every period, up to a number of times. */
  SCHEDULE = 'schedule',
}
