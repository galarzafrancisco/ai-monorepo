import { OpenAPI, AgentService, ChatService } from 'shared';
import { BFF_BASE_URL } from '../config/api';

// Use centralized API configuration
OpenAPI.BASE = BFF_BASE_URL;

export { AgentService, ChatService, OpenAPI };
