import { mkdir, readFile, rename, unlink, writeFile } from 'fs/promises';
import lockfile from 'proper-lockfile';
import { dirname, join } from 'path';
import { homedir } from 'os';
import type {
  WorkerCredentials,
  MultiServerConfig,
  LegacyWorkerCredentials,
} from './worker-auth.types.js';

export const DEFAULT_TAICO_DIRECTORY = join(homedir(), '.taico');

export const DEFAULT_WORKER_CREDENTIALS_PATH = join(
  DEFAULT_TAICO_DIRECTORY,
  'worker-credentials.json',
);

export const DEFAULT_WORKER_WORKSPACES_PATH = join(
  DEFAULT_TAICO_DIRECTORY,
  'workspaces',
);

/**
 * Reads worker credentials from disk.
 * Handles migration from legacy single-server format to multi-server format.
 * If legacy format is detected, the file is deleted to trigger re-authentication.
 *
 * @param credentialsPath - Path to the credentials file
 * @param serverUrl - Server URL to get credentials for
 * @param workspace - Workspace slug the worker was started for, if any
 * @returns WorkerCredentials for the specified server, or null if not found or migration needed
 */
export async function readWorkerCredentials(
  credentialsPath: string,
  serverUrl: string,
  workspace?: string,
): Promise<WorkerCredentials | null> {
  try {
    const content = await readFile(credentialsPath, 'utf8');
    const parsed = JSON.parse(content) as unknown;

    // Check if this is the new multi-server format
    if (isMultiServerConfig(parsed)) {
      const config = parsed as MultiServerConfig;
      return config.servers[credentialsKey(serverUrl, workspace)] ?? null;
    }

    // Legacy format detected - delete file to trigger re-authentication
    if (isLegacyCredentials(parsed)) {
      console.log(
        '[worker] Legacy credentials format detected. Deleting to trigger re-authentication.',
      );
      await deleteLegacyCredentials(credentialsPath);
      return null;
    }

    // Unknown format - treat as corrupted
    console.warn('[worker] Unknown credentials format. Deleting corrupted file.');
    await deleteLegacyCredentials(credentialsPath);
    return null;
  } catch {
    return null;
  }
}

/**
 * Writes worker credentials to disk in multi-server format.
 * If credentials already exist for other servers, they are preserved.
 *
 * @param credentialsPath - Path to the credentials file
 * @param credentials - Credentials to write
 */
export async function writeWorkerCredentials(
  credentialsPath: string,
  credentials: WorkerCredentials,
): Promise<void> {
  await mkdir(dirname(credentialsPath), { recursive: true });

  // Several workers (one per workspace, say) share this file. The lock makes
  // each read/merge/write whole across processes, so no worker writes back a
  // stale copy over another's entry; the rename means readers never see a
  // half-written file.
  let compromised: Error | undefined;
  const release = await lockfile.lock(credentialsPath, {
    // The file may not exist yet on the first authorization.
    realpath: false,
    // The lock is refreshed while held, so only a dead holder goes stale.
    stale: 10_000,
    retries: { retries: 100, minTimeout: 20, maxTimeout: 200 },
    onCompromised: (error) => {
      compromised = error;
    },
  });
  const tempPath = `${credentialsPath}.${process.pid}.${Date.now()}.tmp`;
  try {
    let config: MultiServerConfig = { servers: {} };
    try {
      const parsed = JSON.parse(await readFile(credentialsPath, 'utf8')) as unknown;
      if (isMultiServerConfig(parsed)) {
        config = parsed as MultiServerConfig;
      }
    } catch {
      // No file yet (or unreadable): start a new one
    }

    // Update credentials for this server (and workspace)
    config.servers[credentialsKey(credentials.serverUrl, credentials.workspace)] =
      credentials;

    await writeFile(tempPath, JSON.stringify(config, null, 2), {
      encoding: 'utf8',
      mode: 0o600,
    });
    // Another process took the lock over while this one was stalled: writing
    // now could overwrite its entry.
    if (compromised) throw compromised;
    await rename(tempPath, credentialsPath);
  } finally {
    await unlink(tempPath).catch(() => undefined);
    // Releasing a lock that was taken over fails; the new holder keeps it.
    await release().catch(() => undefined);
  }
}

/**
 * Gets the list of configured servers.
 *
 * @param credentialsPath - Path to the credentials file
 * @returns Array of server URLs that have credentials stored
 */
export async function listConfiguredServers(
  credentialsPath: string,
): Promise<string[]> {
  try {
    const content = await readFile(credentialsPath, 'utf8');
    const parsed = JSON.parse(content) as unknown;

    if (isMultiServerConfig(parsed)) {
      const config = parsed as MultiServerConfig;
      return Object.keys(config.servers);
    }

    return [];
  } catch {
    return [];
  }
}


async function deleteLegacyCredentials(credentialsPath: string): Promise<void> {
  try {
    await unlink(credentialsPath);
  } catch {
    // Ignore errors if file doesn't exist
  }
}

function isMultiServerConfig(value: unknown): boolean {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const obj = value as Record<string, unknown>;
  return typeof obj.servers === 'object' && obj.servers !== null;
}

function isLegacyCredentials(value: unknown): boolean {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const obj = value as Record<string, unknown>;
  return (
    typeof obj.serverUrl === 'string' &&
    typeof obj.clientId === 'string' &&
    typeof obj.accessToken === 'string' &&
    typeof obj.refreshToken === 'string'
  );
}

/**
 * Where a worker's credentials are kept in the file. A worker started with
 * `--workspace` has its own entry per workspace, so several workers on one
 * machine can each work in another workspace of the same server. Without
 * it, the entry is the server URL, as before.
 */
export function credentialsKey(serverUrl: string, workspace?: string): string {
  const normalizedUrl = normalizeServerUrl(serverUrl);
  return workspace ? `${normalizedUrl}#workspace=${workspace}` : normalizedUrl;
}

function normalizeServerUrl(url: string): string {
  return url.replace(/\/+$/, '');
}
