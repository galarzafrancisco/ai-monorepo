import { OpenAPI, WikirooService } from 'shared';
import { API_BASE_URL } from '../config/api';

// Use centralized API configuration
OpenAPI.BASE = API_BASE_URL;

export { WikirooService };
