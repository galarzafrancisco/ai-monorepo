import { BaseClient, ClientConfig } from './base-client.js';
import type { LookupPullRequestsDto, PullRequestResponseDto } from './types.js';

export class PullRequestsResource extends BaseClient {
  constructor(config: ClientConfig) {
    super(config);
  }

  /** Status of linked pull requests, in the order asked */
  async PullRequestsController_lookup(params: { body: LookupPullRequestsDto; signal?: AbortSignal }): Promise<PullRequestResponseDto[]> {
    return this.request('POST', '/api/v1/pull-requests/lookup', { body: params.body, signal: params?.signal });
  }

  /** Stored status of one pull request */
  async PullRequestsController_get(params: { id: string; signal?: AbortSignal }): Promise<PullRequestResponseDto> {
    return this.request('GET', `/api/v1/pull-requests/${params.id}`, { signal: params?.signal });
  }

  /** Read the pull request from GitHub now */
  async PullRequestsController_refresh(params: { id: string; signal?: AbortSignal }): Promise<PullRequestResponseDto> {
    return this.request('POST', `/api/v1/pull-requests/${params.id}/refresh`, { signal: params?.signal });
  }

}