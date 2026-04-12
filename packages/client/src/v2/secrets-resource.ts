import { BaseClient, ClientConfig } from './base-client.js';
import type { CreateSecretDto, SecretResponseDto, SecretValueResponseDto, UpdateSecretDto } from './types.js';

export class SecretsResource extends BaseClient {
  constructor(config: ClientConfig) {
    super(config);
  }

  /** Create a new secret */
  async SecretsController_createSecret(params: { body: CreateSecretDto; signal?: AbortSignal }): Promise<SecretResponseDto> {
    return this.request('POST', '/api/v1/secrets', { body: params.body, signal: params?.signal });
  }

  /** List all secrets - values not included */
  async SecretsController_listSecrets(params?: { signal?: AbortSignal }): Promise<SecretResponseDto[]> {
    return this.request('GET', '/api/v1/secrets', { signal: params?.signal });
  }

  /** Get secret metadata by ID - value not included */
  async SecretsController_getSecret(params: { id: string; signal?: AbortSignal }): Promise<SecretResponseDto> {
    return this.request('GET', `/api/v1/secrets/${params.id}`, { signal: params?.signal });
  }

  /** Update a secret */
  async SecretsController_updateSecret(params: { id: string; body: UpdateSecretDto; signal?: AbortSignal }): Promise<SecretResponseDto> {
    return this.request('PATCH', `/api/v1/secrets/${params.id}`, { body: params.body, signal: params?.signal });
  }

  /** Delete a secret */
  async SecretsController_deleteSecret(params: { id: string; signal?: AbortSignal }): Promise<void> {
    return this.request('DELETE', `/api/v1/secrets/${params.id}`, { responseType: 'void', signal: params?.signal });
  }

  /** Get decrypted secret value */
  async SecretsController_getSecretValue(params: { id: string; signal?: AbortSignal }): Promise<SecretValueResponseDto> {
    return this.request('GET', `/api/v1/secrets/${params.id}/value`, { signal: params?.signal });
  }

}