export type WorkerCredentials = {
  serverUrl: string;
  clientId: string;
  redirectUri: string;
  scope: string;
  accessToken: string;
  refreshToken: string;
  expiresAt: string;
};

/**
 * Multi-server worker configuration (kubeconfig-style).
 * Maps server URLs to their credentials.
 */
export type MultiServerConfig = {
  currentServer: string;
  servers: {
    [serverUrl: string]: WorkerCredentials;
  };
};

/**
 * Legacy single-server credentials format.
 * Used for migration detection.
 */
export type LegacyWorkerCredentials = WorkerCredentials;
