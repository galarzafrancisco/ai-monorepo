import { setTimeout as sleep } from 'timers/promises';
import { ApiClient } from '@taico/client/v2';
import { WorkerAuth } from './auth/worker-auth';

const QUEUE_POLL_INTERVAL_MS = 5_000;

type WorkerOptions = {
  serverUrl: string;
  credentialsPath?: string;
};

export async function runWorker(options: WorkerOptions): Promise<void> {
  const auth = new WorkerAuth({
    serverUrl: options.serverUrl,
    credentialsPath: options.credentialsPath,
  });

  console.log(`[worker] Starting worker mode against ${auth.serverUrl}`);

  const bootstrap = await auth.ensureAuthenticated();
  if (bootstrap.didBootstrap) {
    console.log(
      `[worker] Stored credentials at ${auth.getCredentialsPath()}`,
    );
  }

  const client = new ApiClient({
    baseUrl: auth.serverUrl,
    getAccessToken: () => auth.getAccessToken(),
  });

  console.log('[worker] Connectivity check succeeded.');
  console.log(
    `[worker] Polling executions-v2 queue every ${QUEUE_POLL_INTERVAL_MS / 1000}s.`,
  );

  while (true) {
    try {
      const queue =
        await client.executionsV2.TaskExecutionQueueController_listQueue();
      console.log(
        `[worker] Queue poll succeeded. ${queue.length} task(s) ready.`,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[worker] Queue poll failed: ${message}`);
    }

    await sleep(QUEUE_POLL_INTERVAL_MS);
  }
}
