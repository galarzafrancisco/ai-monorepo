import { BaseClient, ClientConfig } from './base-client.js';
import type { AccountSetupStatusRequestDto, AccountSetupStatusResponseDto, ChangePasswordRequestDto, CreateManagedUserRequestDto, LoginRequestDto, LoginResponseDto, ManagedUserResponseDto, OnboardingRequestDto, OnboardingStatusResponseDto, SetupManagedUserRequestDto, UserResponseDto } from './types.js';

export class WebAuthenticationResource extends BaseClient {
  constructor(config: ClientConfig) {
    super(config);
  }

  /** Login with email and password */
  async WebAuthController_login(params: { body: LoginRequestDto; signal?: AbortSignal }): Promise<LoginResponseDto> {
    return this.request('POST', '/api/v1/auth/login', { body: params.body, signal: params?.signal });
  }

  /** List human users for admin user management */
  async WebAuthController_listUsers(params?: { signal?: AbortSignal }): Promise<ManagedUserResponseDto[]> {
    return this.request('GET', '/api/v1/auth/users', { signal: params?.signal });
  }

  /** Create an invited human user */
  async WebAuthController_createUser(params: { body: CreateManagedUserRequestDto; signal?: AbortSignal }): Promise<ManagedUserResponseDto> {
    return this.request('POST', '/api/v1/auth/users', { body: params.body, signal: params?.signal });
  }

  /** Reset a managed user password so they can set a new one */
  async WebAuthController_resetUserPassword(params: { userId: string; signal?: AbortSignal }): Promise<ManagedUserResponseDto> {
    return this.request('POST', `/api/v1/auth/users/${params.userId}/reset-password`, { signal: params?.signal });
  }

  /** Deactivate a managed user */
  async WebAuthController_deleteUser(params: { userId: string; signal?: AbortSignal }): Promise<ManagedUserResponseDto> {
    return this.request('DELETE', `/api/v1/auth/users/${params.userId}`, { signal: params?.signal });
  }

  /** Check whether an invited or reset account can be set up */
  async WebAuthController_getAccountSetupStatus(params: { body: AccountSetupStatusRequestDto; signal?: AbortSignal }): Promise<AccountSetupStatusResponseDto> {
    return this.request('POST', '/api/v1/auth/account-setup-status', { body: params.body, signal: params?.signal });
  }

  /** Set up an invited or reset account and log in */
  async WebAuthController_setupAccount(params: { body: SetupManagedUserRequestDto; signal?: AbortSignal }): Promise<LoginResponseDto> {
    return this.request('POST', '/api/v1/auth/setup-account', { body: params.body, signal: params?.signal });
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