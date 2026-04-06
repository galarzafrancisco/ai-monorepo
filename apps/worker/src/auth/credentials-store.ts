import { mkdir, readFile, writeFile } from 'fs/promises';
import { dirname, join } from 'path';
import { homedir } from 'os';
import type { WorkerCredentials } from './worker-auth.types.js';

export const DEFAULT_TAICO_DIRECTORY = join(homedir(), '.taico');

export const DEFAULT_WORKER_CREDENTIALS_PATH = join(
  DEFAULT_TAICO_DIRECTORY,
  'worker-credentials.json',
);

export const DEFAULT_WORKER_WORKSPACES_PATH = join(
  DEFAULT_TAICO_DIRECTORY,
  'workspaces',
);

export async function readWorkerCredentials(
  credentialsPath: string,
): Promise<WorkerCredentials | null> {
  try {
    const content = await readFile(credentialsPath, 'utf8');
    return JSON.parse(content) as WorkerCredentials;
  } catch {
    return null;
  }
}

export async function writeWorkerCredentials(
  credentialsPath: string,
  credentials: WorkerCredentials,
): Promise<void> {
  await mkdir(dirname(credentialsPath), { recursive: true });
  await writeFile(credentialsPath, JSON.stringify(credentials, null, 2), 'utf8');
}
