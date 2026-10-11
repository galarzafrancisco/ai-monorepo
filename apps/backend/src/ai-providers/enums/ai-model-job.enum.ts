/** A job Taico's own server-side agents need a model for. */
export enum AiModelJob {
  /** The threads agent's main conversation. */
  CONVERSATION = 'conversation',
  /** Small background calls such as thread titles and hooks. */
  QUICK_TASKS = 'quick_tasks',
  /** The thread state reconciler. */
  MIDDLE_MANAGER = 'middle_manager',
  /** Search embeddings. Changing it means re-indexing. */
  EMBEDDINGS = 'embeddings',
}

/** Jobs that use the conversation model when they have no selection of their own. */
export const JOBS_FOLLOWING_CONVERSATION: readonly AiModelJob[] = [
  AiModelJob.QUICK_TASKS,
  AiModelJob.MIDDLE_MANAGER,
];
