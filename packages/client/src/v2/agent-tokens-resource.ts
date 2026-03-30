import { BaseClient, ClientConfig } from './base-client.js';
import type { IssueAccessTokenRequestDto, IssueAccessTokenResponseDto, IssuedAccessTokenResponseDto } from './types.js';

export class AgentTokensResource extends BaseClient {
  constructor(config: ClientConfig) {
    super(config);
  }

  /** Issue a new access token for an agent */
  async AgentTokensController_issueToken(params: { slug: string; body: IssueAccessTokenRequestDto; signal?: AbortSignal }): Promise<IssueAccessTokenResponseDto> {
    return this.request('POST', `/api/v1/agents/${params.slug}/tokens`, { body: params.body, signal: params?.signal });
  }

  /** List all tokens for an agent */
  async AgentTokensController_listTokens(params: { slug: string; signal?: AbortSignal }): Promise<IssuedAccessTokenResponseDto[]> {
    return this.request('GET', `/api/v1/agents/${params.slug}/tokens`, { signal: params?.signal });
  }

  /** Revoke an agent token */
  async AgentTokensController_revokeToken(params: { slug: string; tokenId: string; signal?: AbortSignal }): Promise<IssuedAccessTokenResponseDto> {
    return this.request('DELETE', `/api/v1/agents/${params.slug}/tokens/${params.tokenId}`, { signal: params?.signal });
  }

}