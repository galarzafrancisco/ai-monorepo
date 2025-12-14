import { AuthorizationServerService, OpenAPI } from 'shared';
import { BFF_BASE_URL } from '../config/api';

// Centralized API client configuration for consent flows
OpenAPI.BASE = BFF_BASE_URL;

export { AuthorizationServerService, OpenAPI };
