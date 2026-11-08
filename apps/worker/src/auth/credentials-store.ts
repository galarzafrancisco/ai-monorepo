import { mkdir, open, readFile, rename, stat, unlink, writeFile } from 'fs/promises';
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
  // each read/merge/write whole, so no worker writes back a stale copy over
  // another's entry; the rename means readers never see a half-written file.
  await withFileLock(`${credentialsPath}.lock`, async () => {
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

    const tempPath = `${credentialsPath}.${process.pid}.${Date.now()}.tmp`;
    await writeFile(tempPath, JSON.stringify(config, null, 2), {
      encoding: 'utf8',
      mode: 0o600,
    });
    await rename(tempPath, credentialsPath);
  });
}

/** A lock left by a process that died mid-write is taken over after this. */
const STALE_LOCK_MS = 10_000;
const LOCK_RETRY_MS = 20;

/**
 * Runs `fn` holding a lock file, across processes: creating the file with
 * `wx` succeeds for exactly one of them.
 */
async function withFileLock<T>(lockPath: string, fn: () => Promise<T>): Promise<T> {
  for (;;) {
    try {
      const handle = await open(lockPath, 'wx');
      await handle.close();
      break;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
      const age = await stat(lockPath).then(
        (s) => Date.now() - s.mtimeMs,
        () => 0,
      );
      if (age > STALE_LOCK_MS) {
        await unlink(lockPath).catch(() => undefined);
        continue;
      }
      await new Promise((resolve) => setTimeout(resolve, LOCK_RETRY_MS));
    }
  }
  try {
    return await fn();
  } finally {
    await unlink(lockPath).catch(() => undefined);
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
