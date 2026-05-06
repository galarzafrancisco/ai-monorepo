import type { AuthorizationStorage } from '../types.js';

export function memoryStorage(): AuthorizationStorage {
  return {
    clients: new Map(),
    interactions: new Map(),
    grants: new Map(),
    downstreamConnections: new Map(),
  };
}
