import { OpenAPI, ToolsService } from 'shared';
import { BFF_BASE_URL } from '../../config/api';

// Use centralized API configuration
OpenAPI.BASE = BFF_BASE_URL;

export { ToolsService };

// Export API client for easier access to all endpoints
export const api = {
  tools: ToolsService,
};
