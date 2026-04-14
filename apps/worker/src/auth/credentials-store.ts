import { mkdir, readFile, writeFile, unlink } from 'fs/promises';
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
 * @returns WorkerCredentials for the specified server, or null if not found or migration needed
 */
export async function readWorkerCredentials(
  credentialsPath: string,
  serverUrl: string,
): Promise<WorkerCredentials | null> {
  try {
    const content = await readFile(credentialsPath, 'utf8');
    const parsed = JSON.parse(content) as unknown;

    // Check if this is the new multi-server format
    if (isMultiServerConfig(parsed)) {
      const config = parsed as MultiServerConfig;
      const normalizedUrl = normalizeServerUrl(serverUrl);
      return config.servers[normalizedUrl] ?? null;
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

  let config: MultiServerConfig;

  try {
    const content = await readFile(credentialsPath, 'utf8');
    const parsed = JSON.parse(content) as unknown;

    if (isMultiServerConfig(parsed)) {
      config = parsed as MultiServerConfig;
    } else {
      // Create new config if existing file is not multi-server format
      config = {
        servers: {},
      };
    }
  } catch {
    // Create new config if file doesn't exist
    config = {
      servers: {},
    };
  }

  // Update credentials for this server
  const normalizedUrl = normalizeServerUrl(credentials.serverUrl);
  config.servers[normalizedUrl] = credentials;

  await writeFile(
    credentialsPath,
    JSON.stringify(config, null, 2),
    'utf8',
  );
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

function normalizeServerUrl(url: string): string {
  return url.replace(/\/+$/, '');
}
