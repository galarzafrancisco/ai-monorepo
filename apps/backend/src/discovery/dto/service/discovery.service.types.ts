import { GrantType } from '../../../authorization-server/enums';

export type ServerLookupStrategy = 'id' | 'providedId';

export type GetAuthorizationServerMetadataInput = {
  serverIdentifier: string;
  version: string;
  issuer: string;
  lookupBy: ServerLookupStrategy;
};

export type AuthorizationServerMetadataResult = {
  issuer: string;
  authorization_endpoint: string;
  token_endpoint: string;
  registration_endpoint: string;
  scopes_supported: string[];
  response_types_supported: string[];
  grant_types_supported: GrantType[];
  token_endpoint_auth_methods_supported: string[];
  token_endpoint_auth_signing_alg_values_supported: string[];
  code_challenge_methods_supported: string[];
  client_id_metadata_document_supported: boolean;
};

export type ProtectedResourceMetadataResult = {
  resource: string;
  authorization_servers: string[];
  scopes_supported: string[];
  bearer_methods_supported: string[];
  resource_name: string;
};

export type SystemServer = {
  path: string;
  metadata: ProtectedResourceMetadataResult;
};
