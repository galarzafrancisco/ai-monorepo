/**
 * Keeps a locally held list in step with the server when it is fed by two
 * sources: full snapshots fetched over HTTP, and live changes (socket events,
 * the user's own actions) applied on top.
 *
 * The two can cross. A snapshot fetched before a change may arrive after it,
 * and applying it would undo the change. There is no version number to tell
 * the two cases apart, so the rule is:
 *
 * - Only one fetch runs at a time.
 * - A snapshot is thrown away if anything changed locally while it was being
 *   fetched, and a new one is fetched in its place.
 * - A refresh asked for while a fetch is running causes one more fetch after
 *   it, because the running one may have started too early to see the reason.
 *
 * The last snapshot applied therefore always started after the last known
 * change.
 *
 * This file has no imports on purpose: the backend e2e suite loads it to test
 * it against a real server (`apps/backend/test/thread-read-state.e2e-spec.ts`).
 */
export type SnapshotSync = {
  /**
   * Fetches a snapshot and applies it. Resolves once the list is up to date,
   * and rejects if the last fetch failed.
   */
  refresh: () => Promise<void>;
  /** Call whenever the list is changed locally, by an event or a user action. */
  noteChange: () => void;
};

export const createSnapshotSync = <T>(
  fetchSnapshot: () => Promise<T>,
  applySnapshot: (snapshot: T) => void,
): SnapshotSync => {
  let running: Promise<void> | null = null;
  let fetchAgain = false;
  let changedDuringFetch = false;

  const run = async (): Promise<void> => {
    try {
      for (;;) {
        fetchAgain = false;
        changedDuringFetch = false;

        let snapshot: T;
        try {
          snapshot = await fetchSnapshot();
        } catch (error) {
          if (fetchAgain) continue;
          throw error;
        }

        if (!changedDuringFetch) {
          applySnapshot(snapshot);
        }
        if (!fetchAgain) return;
      }
    } finally {
      running = null;
    }
  };

  return {
    refresh: () => {
      if (running) {
        fetchAgain = true;
        return running;
      }
      running = run();
      return running;
    },
    noteChange: () => {
      if (running) {
        fetchAgain = true;
        changedDuringFetch = true;
      }
    },
  };
};
