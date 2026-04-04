import { setTimeout as sleep } from 'timers/promises';

const SIMULATED_WORK_DURATION_MS = 5_000;

export async function runPlaceholderTask(
  taskId: string,
  executionId: string,
): Promise<void> {
  console.log(
    `[worker] Placeholder run for task ${taskId} (execution ${executionId}). Simulating work for ${SIMULATED_WORK_DURATION_MS / 1000}s.`,
  );
  await sleep(SIMULATED_WORK_DURATION_MS);
}
