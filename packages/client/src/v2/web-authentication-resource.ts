import { BaseClient, ClientConfig } from './base-client.js';
import type { ChangePasswordRequestDto, LoginRequestDto, LoginResponseDto, OnboardingRequestDto, OnboardingStatusResponseDto, UserResponseDto } from './types.js';

export class WebAuthenticationResource extends BaseClient {
  constructor(config: ClientConfig) {
    super(config);
  }

  /** Login with email and password */
  async WebAuthController_login(params: { body: LoginRequestDto; signal?: AbortSignal }): Promise<LoginResponseDto> {
    return this.request('POST', '/api/v1/auth/login', { body: params.body, signal: params?.signal });
  }

  /** Refresh access token using refresh token */
  async WebAuthController_refresh(params?: { signal?: AbortSignal }): Promise<LoginResponseDto> {
    return this.request('POST', '/api/v1/auth/refresh', { signal: params?.signal });
  }

  /** Logout and revoke refresh token */
  async WebAuthController_logout(params?: { signal?: AbortSignal }): Promise<{ ok?: boolean }> {
    return this.request('POST', '/api/v1/auth/logout', { signal: params?.signal });
  }

  /** Get current authenticated user */
  async WebAuthController_me(params?: { signal?: AbortSignal }): Promise<UserResponseDto> {
    return this.request('GET', '/api/v1/auth/me', { signal: params?.signal });
  }

  /** Change password for authenticated user */
  async WebAuthController_changePassword(params: { body: ChangePasswordRequestDto; signal?: AbortSignal }): Promise<{ ok?: boolean }> {
    return this.request('POST', '/api/v1/auth/change-password', { body: params.body, signal: params?.signal });
  }

  /** Check if system needs onboarding */
  async WebAuthController_getOnboardingStatus(params?: { signal?: AbortSignal }): Promise<OnboardingStatusResponseDto> {
    return this.request('GET', '/api/v1/auth/onboarding-status', { signal: params?.signal });
  }

  /** Create first admin user (only works if no admins exist) */
  async WebAuthController_onboard(params: { body: OnboardingRequestDto; signal?: AbortSignal }): Promise<LoginResponseDto> {
    return this.request('POST', '/api/v1/auth/onboard', { body: params.body, signal: params?.signal });
  }

  /** Mark walkthrough as seen for authenticated user */
  async WebAuthController_markWalkthroughSeen(params?: { signal?: AbortSignal }): Promise<{ ok?: boolean }> {
    return this.request('POST', '/api/v1/auth/mark-walkthrough-seen', { signal: params?.signal });
  }

}