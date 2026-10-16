/**
 * Keeps the thread list in the order the server lists it: the user's pinned
 * threads first, then the thread with the latest message people can see
 * first, and the id to break ties.
 *
 * Moving a thread up and counting a message as unread are separate decisions.
 * Every visible message moves its thread up, including the user's own and ones
 * in the thread they have open. Only messages from someone else, in a thread
 * the user is not looking at, count as unread.
 *
 * This file has no imports on purpose: the backend e2e suite loads it to test
 * it against a real server (`apps/backend/test/thread-ordering.e2e-spec.ts`).
 */
export type OrderedThread = {
  id: string;
  /** ISO 8601 in UTC, as the API sends it, so plain string comparison orders it. */
  lastActivityAt: string;
  unreadCount: number;
  /** The user pinned it. Pinned threads come before all others. */
  pinned?: boolean;
};

export type ThreadActivity = {
  threadId: string;
  createdByActorId: string | null;
  /** When the message was posted. ISO 8601 in UTC. */
  createdAt: string;
};

export type ThreadListViewer = {
  actorId: string | undefined;
  /** The thread the user is looking at right now, if any. */
  viewingThreadId: string | null;
};

/**
 * Pinned first; then newest activity first; on a tie, the higher id first.
 * Same as the server.
 */
export const compareThreads = (a: OrderedThread, b: OrderedThread): number => {
  if (Boolean(a.pinned) !== Boolean(b.pinned)) {
    return a.pinned ? -1 : 1;
  }
  if (a.lastActivityAt !== b.lastActivityAt) {
    return a.lastActivityAt < b.lastActivityAt ? 1 : -1;
  }
  if (a.id === b.id) return 0;
  return a.id < b.id ? 1 : -1;
};

/**
 * Applies one posted message to the list. Returns null when the list has not
 * loaded the thread, in which case the caller should fetch the list again.
 */
export const applyThreadActivity = <T extends OrderedThread>(
  threads: T[],
  activity: ThreadActivity,
  viewer: ThreadListViewer,
): T[] | null => {
  const current = threads.find((thread) => thread.id === activity.threadId);
  if (!current) {
    return null;
  }

  // The user wrote it, or is watching it arrive: the open chat marks it read.
  const isUnread =
    activity.createdByActorId !== viewer.actorId &&
    viewer.viewingThreadId !== activity.threadId;

  const updated: T = {
    ...current,
    // An event can arrive after a snapshot that already includes a newer message.
    lastActivityAt:
      activity.createdAt > current.lastActivityAt
        ? activity.createdAt
        : current.lastActivityAt,
    unreadCount: current.unreadCount + (isUnread ? 1 : 0),
  };

  return threads
    .map((thread) => (thread.id === updated.id ? updated : thread))
    .sort(compareThreads);
};

/**
 * Pins or unpins one thread and moves it to where the server now lists it.
 * Returns the list unchanged when it has not loaded the thread.
 */
export const applyThreadPinned = <T extends OrderedThread>(
  threads: T[],
  threadId: string,
  pinned: boolean,
): T[] => {
  const current = threads.find((thread) => thread.id === threadId);
  if (!current || Boolean(current.pinned) === pinned) {
    return threads;
  }

  return threads
    .map((thread) => (thread.id === threadId ? { ...thread, pinned } : thread))
    .sort(compareThreads);
};
