/**
 * Splits the list into the user's pinned threads and the rest, keeping the
 * order within each group. The list is already sorted pinned-first.
 */
export const splitPinnedThreads = <T extends { pinned?: boolean }>(
  threads: T[],
): { pinnedThreads: T[]; otherThreads: T[] } => {
  const pinnedThreads: T[] = [];
  const otherThreads: T[] = [];
  for (const thread of threads) {
    (thread.pinned ? pinnedThreads : otherThreads).push(thread);
  }
  return { pinnedThreads, otherThreads };
};
