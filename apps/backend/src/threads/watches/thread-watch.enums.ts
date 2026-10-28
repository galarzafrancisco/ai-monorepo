/**
 * What a thread can watch. Each kind has a handler that listens to its own
 * domain events and queues deliveries through ThreadWatchesService; storage,
 * delivery to the agent, expiry, listing and cancelling are shared.
 */
export enum ThreadWatchKind {
  PULL_REQUEST = 'pull_request',
}
