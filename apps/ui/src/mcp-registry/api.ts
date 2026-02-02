import { OpenAPI, ToolsService, AuthorizationJourneysService } from "@taico/client";
import { BFF_BASE_URL } from '../config/api';

// Use centralized API configuration
OpenAPI.BASE = BFF_BASE_URL;

export { ToolsService, AuthorizationJourneysService };