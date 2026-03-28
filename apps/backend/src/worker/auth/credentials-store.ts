import { mkdir, readFile, writeFile } from 'fs/promises';
import { dirname, join } from 'path';
import { homedir } from 'os';
import type { WorkerCredentials, MultiServerCredentials } from './worker-auth.types';

export const DEFAULT_WORKER_CREDENTIALS_PATH = join(
  homedir(),
  '.taico',
  'worker-credentials.json',
);

/**
 * Normalizes a server URL to use as a key in the credentials map.
 * Removes trailing slashes and converts to lowercase for consistent matching.
 */
function normalizeServerUrl(serverUrl: string): string {
  return serverUrl.replace(/\/+$/, '').toLowerCase();
}

/**
 * Reads multi-server credentials from disk.
 * Automatically migrates old single-credential format to multi-server format.
 */
export async function readMultiServerCredentials(
  credentialsPath: string,
): Promise<MultiServerCredentials> {
  try {
    const content = await readFile(credentialsPath, 'utf8');
    const parsed = JSON.parse(content);

    // Check if it's the old single-credential format
    if (parsed.serverUrl && parsed.accessToken) {
      // Migrate from old format to new format
      const oldCredentials = parsed as WorkerCredentials;
      const normalizedUrl = normalizeServerUrl(oldCredentials.serverUrl);
      return {
        servers: {
          [normalizedUrl]: oldCredentials,
        },
      };
    }

    // Already in new format
    return parsed as MultiServerCredentials;
  } catch {
    // File doesn't exist or is invalid, return empty credentials
    return { servers: {} };
  }
}

/**
 * Writes multi-server credentials to disk.
 */
export async function writeMultiServerCredentials(
  credentialsPath: string,
  credentials: MultiServerCredentials,
): Promise<void> {
  await mkdir(dirname(credentialsPath), { recursive: true });
  await writeFile(credentialsPath, JSON.stringify(credentials, null, 2), 'utf8');
}

/**
 * Reads credentials for a specific server URL.
 */
export async function readServerCredentials(
  credentialsPath: string,
  serverUrl: string,
): Promise<WorkerCredentials | null> {
  const multiCreds = await readMultiServerCredentials(credentialsPath);
  const normalizedUrl = normalizeServerUrl(serverUrl);
  return multiCreds.servers[normalizedUrl] || null;
}

/**
 * Writes credentials for a specific server URL.
 */
export async function writeServerCredentials(
  credentialsPath: string,
  serverUrl: string,
  credentials: WorkerCredentials,
): Promise<void> {
  const multiCreds = await readMultiServerCredentials(credentialsPath);
  const normalizedUrl = normalizeServerUrl(serverUrl);
  multiCreds.servers[normalizedUrl] = credentials;
  await writeMultiServerCredentials(credentialsPath, multiCreds);
}

/**
 * @deprecated Use readServerCredentials instead
 */
export async function readWorkerCredentials(
  credentialsPath: string,
): Promise<WorkerCredentials | null> {
  // For backward compatibility, return any credentials found
  const multiCreds = await readMultiServerCredentials(credentialsPath);
  const servers = Object.values(multiCreds.servers);
  return servers.length > 0 ? servers[0] : null;
}

/**
 * @deprecated Use writeServerCredentials instead
 */
export async function writeWorkerCredentials(
  credentialsPath: string,
  credentials: WorkerCredentials,
): Promise<void> {
  await writeServerCredentials(credentialsPath, credentials.serverUrl, credentials);
}
