export type WorkerCredentials = {
  serverUrl: string;
  /**
   * Slug of the workspace the worker was started for (`--workspace`). Absent
   * for a worker started without it: it works in the workspace it was
   * approved in.
   */
  workspace?: string;
  clientId: string;
  redirectUri: string;
  scope: string;
  accessToken: string;
  refreshToken: string;
  expiresAt: string;
};

/**
 * Multi-server worker configuration (kubeconfig-style).
 * Maps a server URL, plus the workspace for a worker started with
 * `--workspace` (see `credentialsKey`), to its credentials.
 */
export type MultiServerConfig = {
  servers: {
    [serverUrl: string]: WorkerCredentials;
  };
};

/**
 * Legacy single-server credentials format.
 * Used for migration detection.
 */
export type LegacyWorkerCredentials = WorkerCredentials;
