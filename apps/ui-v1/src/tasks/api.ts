import { OpenAPI, TaskService } from "@taico/client";
import { BFF_BASE_URL } from '../config/api';

// Use centralized API configuration
OpenAPI.BASE = BFF_BASE_URL;

export { TaskService as TasksService };

// Export API client for easier access to all endpoints
export const api = {
  task: TaskService,
};
