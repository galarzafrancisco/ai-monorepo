import { BaseClient, ClientConfig } from './base-client.js';
import type { UserOnboardingStatusResponseDto } from './types.js';

export class OnboardingResource extends BaseClient {
  constructor(config: ClientConfig) {
    super(config);
  }

  /** Get onboarding status for the current user */
  async OnboardingController_getStatus(params?: { signal?: AbortSignal }): Promise<UserOnboardingStatusResponseDto> {
    return this.request('GET', '/api/v1/onboarding/status', { signal: params?.signal });
  }

}