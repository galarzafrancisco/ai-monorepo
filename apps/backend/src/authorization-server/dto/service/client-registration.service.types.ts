import { GrantType, TokenEndpointAuthMethod } from '../../enums';

export type ClientRegistrationResult = {
  clientId: string;
  clientName: string;
  redirectUris: string[];
  grantTypes: GrantType[];
  tokenEndpointAuthMethod: TokenEndpointAuthMethod;
  contacts: string[] | null;
  createdAt: Date;
};
