import { BaseClient, ClientConfig } from './base-client.js';
import type { JwksResponseDto } from './types.js';

export class JwksResource extends BaseClient {
  constructor(config: ClientConfig) {
    super(config);
  }

  /** Get JSON Web Key Set (JWKS) */
  async JwksController_getJwks(params?: { signal?: AbortSignal }): Promise<JwksResponseDto> {
    return this.request('GET', '/.well-known/jwks.json', { signal: params?.signal });
  }

}