const DEFAULT_UNCLAIM_GRACE_PERIOD_MS = 3 * 60 * 1000;
const UNCLAIM_GRACE_PERIOD_MS = readDurationMs(
  process.env.WORKER_UNCLAIM_GRACE_PERIOD_MS,
  DEFAULT_UNCLAIM_GRACE_PERIOD_MS,
);
const deferredTaskClaims = new Map<string, number>();

export function deferTaskClaimAfterUnclaim(taskId: string): void {
  const until = Date.now() + UNCLAIM_GRACE_PERIOD_MS;
  deferredTaskClaims.set(taskId, until);

  console.log(
    `[worker] Deferring claims for task ${taskId} for ${Math.round(UNCLAIM_GRACE_PERIOD_MS / 1000)}s after unclaim.`,
  );
}

export function isTaskClaimDeferred(taskId: string): boolean {
  const deferredUntil = deferredTaskClaims.get(taskId);
  if (!deferredUntil) {
    return false;
  }

  if (deferredUntil <= Date.now()) {
    deferredTaskClaims.delete(taskId);
    return false;
  }

  return true;
}

function readDurationMs(value: string | undefined, fallback: number): number {
  if (!value) {
    return fallback;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return fallback;
  }

  return parsed;
}
