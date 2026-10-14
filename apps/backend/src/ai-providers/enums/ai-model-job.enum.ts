/** A job Taico's own server-side agents need a model for. */
export enum AiModelJob {
  /** The threads agent's main conversation. */
  CONVERSATION = 'conversation',
  /**
   * Small one-shot calls a person started directly, such as naming a thread
   * from the message they wrote. Billed to that person when the provider runs
   * on a person's own plan.
   */
  USER_SMALL_TASKS = 'user_small_tasks',
  /**
   * Small one-shot calls no person started, such as naming a thread an agent
   * created. Always needs a provider with shared (API key) credentials.
   */
  SYSTEM_SMALL_TASKS = 'system_small_tasks',
  /** The thread state reconciler. */
  MIDDLE_MANAGER = 'middle_manager',
  /** Search embeddings. Changing it means re-indexing. */
  EMBEDDINGS = 'embeddings',
}

/** Jobs that use the conversation model when they have no selection of their own. */
export const JOBS_FOLLOWING_CONVERSATION: readonly AiModelJob[] = [
  AiModelJob.USER_SMALL_TASKS,
  AiModelJob.SYSTEM_SMALL_TASKS,
  AiModelJob.MIDDLE_MANAGER,
];

/**
 * Jobs a provider that runs on a person's own plan may be selected for. Each
 * one knows whose plan pays for a call: the conversation uses the person the
 * turn is for, user small tasks the person who started the call, and the
 * middle manager the person who created the thread. Such a provider is never
 * inherited from the conversation; it must be selected for the job directly.
 *
 * System small tasks are deliberately absent: nobody started them, so no
 * person's plan may pay.
 */
export const USER_CONNECTED_PROVIDER_JOBS: readonly AiModelJob[] = [
  AiModelJob.CONVERSATION,
  AiModelJob.USER_SMALL_TASKS,
  AiModelJob.MIDDLE_MANAGER,
];
