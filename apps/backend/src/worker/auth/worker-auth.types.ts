export type AuthorizationServerMetadata = {
  issuer: string;
  authorization_endpoint: string;
  token_endpoint: string;
  registration_endpoint: string;
  scopes_supported: string[];
  response_types_supported: string[];
  grant_types_supported: string[];
  token_endpoint_auth_methods_supported: string[];
  code_challenge_methods_supported: string[];
};

export type WorkerCredentials = {
  serverUrl: string;
  clientId: string;
  redirectUri: string;
  scope: string;
  tokenEndpoint: string;
  authorizationEndpoint: string;
  registrationEndpoint: string;
  accessToken: string;
  refreshToken: string;
  expiresAt: string;
};

export type TokenResponse = {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token?: string;
  scope?: string;
};
