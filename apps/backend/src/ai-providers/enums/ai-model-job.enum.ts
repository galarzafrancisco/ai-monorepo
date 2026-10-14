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

/**
 * Jobs a provider that runs on a person's own plan may be selected for. Each
 * one knows whose plan pays for a call: the conversation uses the person the
 * turn is for, the middle manager the person who created the thread. Such a
 * provider is never inherited from the conversation; it must be selected for
 * the job directly.
 */
export const USER_CONNECTED_PROVIDER_JOBS: readonly AiModelJob[] = [
  AiModelJob.CONVERSATION,
  AiModelJob.MIDDLE_MANAGER,
];
