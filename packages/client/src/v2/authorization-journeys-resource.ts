import { BaseClient, ClientConfig } from './base-client.js';
import type { AuthJourneyResponseDto } from './types.js';

export class AuthorizationJourneysResource extends BaseClient {
  constructor(config: ClientConfig) {
    super(config);
  }

  /** Get authorization journeys for an MCP server (debug/monitoring) */
  async AuthJourneysController_getAuthJourneys(params: { serverId: string; signal?: AbortSignal }): Promise<AuthJourneyResponseDto[]> {
    return this.request('GET', `/api/v1/auth-journeys/servers/${params.serverId}`, { signal: params?.signal });
  }

}