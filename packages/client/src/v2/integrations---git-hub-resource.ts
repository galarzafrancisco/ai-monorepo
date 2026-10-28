import { BaseClient, ClientConfig } from './base-client.js';
import type { CreateGithubConnectionDto, GithubConnectionResponseDto, ResolvedGithubConnectionResponseDto, UpdateGithubConnectionDto } from './types.js';

export class IntegrationsGithubResource extends BaseClient {
  constructor(config: ClientConfig) {
    super(config);
  }

  /** Connect GitHub with a personal access token or a GitHub App installation */
  async GithubConnectionsController_createConnection(params: { body: CreateGithubConnectionDto; signal?: AbortSignal }): Promise<GithubConnectionResponseDto> {
    return this.request('POST', '/api/v1/integrations/github/connections', { body: params.body, signal: params?.signal });
  }

  /** List GitHub connections */
  async GithubConnectionsController_listConnections(params?: { signal?: AbortSignal }): Promise<GithubConnectionResponseDto[]> {
    return this.request('GET', '/api/v1/integrations/github/connections', { signal: params?.signal });
  }

  /** Which connection Taico would use for a repository, and why */
  async GithubConnectionsController_resolveConnection(params: { repoUrl: string; connectionId?: string; signal?: AbortSignal }): Promise<ResolvedGithubConnectionResponseDto> {
    return this.request('GET', '/api/v1/integrations/github/connections/resolve', { params: { repoUrl: params.repoUrl, connectionId: params.connectionId }, signal: params?.signal });
  }

  /** Get a GitHub connection */
  async GithubConnectionsController_getConnection(params: { id: string; signal?: AbortSignal }): Promise<GithubConnectionResponseDto> {
    return this.request('GET', `/api/v1/integrations/github/connections/${params.id}`, { signal: params?.signal });
  }

  /** Update a GitHub connection; a new credential is checked with GitHub before it is saved */
  async GithubConnectionsController_updateConnection(params: { id: string; body: UpdateGithubConnectionDto; signal?: AbortSignal }): Promise<GithubConnectionResponseDto> {
    return this.request('PATCH', `/api/v1/integrations/github/connections/${params.id}`, { body: params.body, signal: params?.signal });
  }

  /** Delete a GitHub connection and its stored credential */
  async GithubConnectionsController_deleteConnection(params: { id: string; signal?: AbortSignal }): Promise<void> {
    return this.request('DELETE', `/api/v1/integrations/github/connections/${params.id}`, { responseType: 'void', signal: params?.signal });
  }

  /** Check the stored credential with GitHub again */
  async GithubConnectionsController_verifyConnection(params: { id: string; signal?: AbortSignal }): Promise<GithubConnectionResponseDto> {
    return this.request('POST', `/api/v1/integrations/github/connections/${params.id}/verify`, { signal: params?.signal });
  }

}