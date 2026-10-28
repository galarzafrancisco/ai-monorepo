import { BaseClient, ClientConfig } from './base-client.js';
import type { IssueResponseDto, LookupIssuesDto } from './types.js';

export class IssuesResource extends BaseClient {
  constructor(config: ClientConfig) {
    super(config);
  }

  /** Status of linked issues, in the order asked */
  async IssuesController_lookup(params: { body: LookupIssuesDto; signal?: AbortSignal }): Promise<IssueResponseDto[]> {
    return this.request('POST', '/api/v1/issues/lookup', { body: params.body, signal: params?.signal });
  }

  /** Stored status of one issue */
  async IssuesController_get(params: { id: string; signal?: AbortSignal }): Promise<IssueResponseDto> {
    return this.request('GET', `/api/v1/issues/${params.id}`, { signal: params?.signal });
  }

  /** Read the issue from GitHub now */
  async IssuesController_refresh(params: { id: string; signal?: AbortSignal }): Promise<IssueResponseDto> {
    return this.request('POST', `/api/v1/issues/${params.id}/refresh`, { signal: params?.signal });
  }

}