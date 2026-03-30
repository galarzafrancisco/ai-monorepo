import { BaseClient, ClientConfig } from './base-client.js';
import type { AgentExecutionTokenResponseDto, RequestAgentExecutionTokenDto } from './types.js';

export class AgentExecutionTokensResource extends BaseClient {
  constructor(config: ClientConfig) {
    super(config);
  }

  /** Request a short-lived execution token for an agent */
  async AgentExecutionTokensController_requestExecutionToken(params: { slug: string; body: RequestAgentExecutionTokenDto; signal?: AbortSignal }): Promise<AgentExecutionTokenResponseDto> {
    return this.request('POST', `/api/v1/agents/${params.slug}/execution-token`, { body: params.body, signal: params?.signal });
  }

}