import { ApiClient } from '@taico/client/v2';
import { BFF_BASE_URL } from '../../config/api';

const baseUrl = BFF_BASE_URL || window.location.origin;

const client = new ApiClient({
  baseUrl,
  credentials: 'include',
});

// Export resources needed by the agents feature
export const AgentsService = client.agent;
export const AgentTokensService = client.agentTokens;
export const AuthorizationServerService = client.authorizationServer;
export const MetaService = client.meta;

// Export API client for easier access to all endpoints
export const api = {
  agent: client.agent,
  tokens: client.agentTokens,
  authorizationServer: client.authorizationServer,
  meta: client.meta,
};
