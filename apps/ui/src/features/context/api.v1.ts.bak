import { OpenAPI, ContextService } from "@taico/client";
import { BFF_BASE_URL } from '../../config/api';

// Use centralized API configuration
OpenAPI.BASE = BFF_BASE_URL;

export { ContextService };

// Export API client for easier access to all endpoints
export const api = {
  context: ContextService,
};
