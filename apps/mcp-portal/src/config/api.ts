/**
 * Centralized API configuration for the MCP Portal frontend.
 *
 * This module provides a single source of truth for backend URL configuration,
 * handling both production and development environments.
 *
 * - In production: Uses relative paths ("/")
 * - In development: Uses http://localhost:{BACKEND_PORT}
 */

/**
 * Get the backend port from environment variables
 */
const getBackendPort = (): number => {
  return import.meta.env.VITE_BACKEND_PORT || 3000;
};

/**
 * Get the base URL for API requests
 *
 * @returns "/" in production, "http://localhost:{port}" in development
 */
export const getApiBaseUrl = (): string => {
  if (import.meta.env.PROD) {
    return '';
  }
  return `http://localhost:${getBackendPort()}`;
};

/**
 * Get the full backend URL including protocol and host
 *
 * @returns Full URL in development, "/" in production
 */
export const getBackendUrl = (): string => {
  if (import.meta.env.PROD) {
    return '/';
  }
  return `http://localhost:${getBackendPort()}`;
};

/**
 * Pre-configured base URL for OpenAPI clients
 */
export const API_BASE_URL = getApiBaseUrl();
