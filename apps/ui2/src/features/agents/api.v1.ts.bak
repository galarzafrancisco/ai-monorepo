import { OpenAPI, AgentService, AgentTokensService } from "@taico/client";
import { BFF_BASE_URL } from '../../config/api';

// Use centralized API configuration
OpenAPI.BASE = BFF_BASE_URL;

export { AgentService as AgentsService };
export { AgentTokensService };

// Export API client for easier access to all endpoints
export const api = {
  agent: AgentService,
  tokens: AgentTokensService,
};
