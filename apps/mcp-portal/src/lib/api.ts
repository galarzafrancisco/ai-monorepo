/**
 * API client configuration for MCP Portal
 *
 * Configures OpenAPI-generated clients from the shared package
 */

import { OpenAPI } from 'shared';
import { API_BASE_URL } from '../config/api';

// Configure base URL for all API clients
OpenAPI.BASE = API_BASE_URL;
OpenAPI.CREDENTIALS = 'include'; // Enable cookie-based auth

// Re-export services for convenience
export {
  McpRegistryService,
  AgentService,
  TaskService,
  WikirooService,
  ChatService,
} from 'shared';
