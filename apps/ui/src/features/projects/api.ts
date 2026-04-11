import { OpenAPI, MetaProjectsService } from "@taico/client";
import { BFF_BASE_URL } from '../../config/api';

// Use centralized API configuration
OpenAPI.BASE = BFF_BASE_URL;

export { MetaProjectsService as ProjectsService };

// Export API client for easier access to all endpoints
export const api = {
  projects: MetaProjectsService,
};
