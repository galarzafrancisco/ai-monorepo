import { OpenAPI, McpRegistryService } from 'shared';
import { BFF_BASE_URL } from '../config/api';

// Use centralized API configuration
OpenAPI.BASE = BFF_BASE_URL;

export { McpRegistryService };
