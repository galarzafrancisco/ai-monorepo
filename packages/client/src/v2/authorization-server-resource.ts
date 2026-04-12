import { BaseClient, ClientConfig } from './base-client.js';
import type { ClientRegistrationResponseDto, ConsentDecisionDto, GetConsentMetadataResponseDto, IntrospectTokenRequestDto, IntrospectTokenResponseDto, RegisterClientDto, ScopesResponseDto, TokenExchangeRequestDto, TokenExchangeResponseDto, TokenRequestDto, TokenResponseDto } from './types.js';

export class AuthorizationServerResource extends BaseClient {
  constructor(config: ClientConfig) {
    super(config);
  }

  /** Register a new OAuth 2.0 client (Dynamic Client Registration) */
  async ClientRegistrationController_registerClient(params: { serverId: string; version: string; body: RegisterClientDto; signal?: AbortSignal }): Promise<ClientRegistrationResponseDto> {
    return this.request('POST', `/api/v1/auth/clients/register/mcp/${params.serverId}/${params.version}`, { body: params.body, signal: params?.signal });
  }

  /** Retrieve client registration information */
  async ClientRegistrationController_getClient(params: { clientId: string; signal?: AbortSignal }): Promise<ClientRegistrationResponseDto> {
    return this.request('GET', `/api/v1/auth/clients/${params.clientId}`, { signal: params?.signal });
  }

  /** List all registered clients (Admin) */
  async ClientRegistrationController_listClients(params?: { signal?: AbortSignal }): Promise<ClientRegistrationResponseDto[]> {
    return this.request('GET', '/api/v1/auth/clients', { signal: params?.signal });
  }

  /** OAuth 2.0 Authorization Endpoint */
  async AuthorizationController_authorize(params: { serverIdentifier: string; version: string; response_type: 'code'; scope?: string; client_id: string; code_challenge: string; code_challenge_method: string; redirect_uri: string; state: string; resource?: string; signal?: AbortSignal }): Promise<void> {
    return this.request('GET', `/api/v1/auth/authorize/mcp/${params.serverIdentifier}/${params.version}`, { params: { response_type: params.response_type, scope: params.scope, client_id: params.client_id, code_challenge: params.code_challenge, code_challenge_method: params.code_challenge_method, redirect_uri: params.redirect_uri, state: params.state, resource: params.resource }, responseType: 'void', signal: params?.signal });
  }

  /** OAuth 2.0 Authorization Consent Handler */
  async AuthorizationController_authorizeConsent(params: { serverIdentifier: string; version: string; body: ConsentDecisionDto; signal?: AbortSignal }): Promise<void> {
    return this.request('POST', `/api/v1/auth/authorize/mcp/${params.serverIdentifier}/${params.version}`, { body: params.body, responseType: 'void', signal: params?.signal });
  }

  /** Get metadata for the consent screen from flow ID */
  async AuthorizationController_getConsentMetadata(params: { flowId: string; signal?: AbortSignal }): Promise<GetConsentMetadataResponseDto> {
    return this.request('GET', `/api/v1/auth/consent/${params.flowId}`, { signal: params?.signal });
  }

  /** OAuth 2.0 Token Endpoint */
  async AuthorizationController_token(params: { serverIdentifier: string; version: string; body: TokenRequestDto; signal?: AbortSignal }): Promise<TokenResponseDto> {
    return this.request('POST', `/api/v1/auth/token/mcp/${params.serverIdentifier}/${params.version}`, { body: params.body, signal: params?.signal });
  }

  /** OAuth 2.0 Token Introspection Endpoint */
  async AuthorizationController_introspect(params: { serverIdentifier: string; version: string; body: IntrospectTokenRequestDto; signal?: AbortSignal }): Promise<IntrospectTokenResponseDto> {
    return this.request('POST', `/api/v1/auth/introspect/mcp/${params.serverIdentifier}/${params.version}`, { body: params.body, signal: params?.signal });
  }

  /** RFC 8693 Token Exchange Endpoint */
  async AuthorizationController_tokenExchange(params: { serverIdentifier: string; version: string; body: TokenExchangeRequestDto; signal?: AbortSignal }): Promise<TokenExchangeResponseDto> {
    return this.request('POST', `/api/v1/auth/token-exchange/mcp/${params.serverIdentifier}/${params.version}`, { body: params.body, signal: params?.signal });
  }

  /** OAuth 2.0 Callback Endpoint for Downstream Systems */
  async AuthorizationController_callback(params: { code: string; state: string; error?: string; scope?: string; error_description?: string; signal?: AbortSignal }): Promise<void> {
    return this.request('GET', '/api/v1/auth/callback', { params: { code: params.code, state: params.state, error: params.error, scope: params.scope, error_description: params.error_description }, responseType: 'void', signal: params?.signal });
  }

  /** List All Available Scopes */
  async AuthorizationController_getScopes(params?: { signal?: AbortSignal }): Promise<ScopesResponseDto> {
    return this.request('GET', '/api/v1/auth/scopes', { signal: params?.signal });
  }

}