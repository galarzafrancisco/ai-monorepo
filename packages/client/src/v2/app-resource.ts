import { BaseClient, ClientConfig } from './base-client.js';

export class AppResource extends BaseClient {
  constructor(config: ClientConfig) {
    super(config);
  }

  /** Health check endpoint */
  async AppController_getHello(params?: { signal?: AbortSignal }): Promise<string> {
    return this.request('GET', '/api/v1', { signal: params?.signal });
  }

  /** Launch script endpoint */
  async AppController_getLaunchScript(params?: { signal?: AbortSignal }): Promise<string> {
    return this.request('GET', '/launch', { responseType: 'text', signal: params?.signal });
  }

}