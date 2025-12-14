/**
 * Centralized API configuration for the frontend application.
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
export const getBFFBaseUrl = (): string => {
  if (import.meta.env.PROD) {
    return '';
  }
  return `http://localhost:${getBackendPort()}`;
};

/**
 * Get the WebSocket URL for real-time connections
 *
 * @param path - The WebSocket path (e.g., "/taskeroo")
 * @returns WebSocket-compatible URL
 */
export const getUIWebSocketUrl = (path: string): string => {
  if (import.meta.env.PROD) {
    return path;
  }
  return `http://localhost:${getBackendPort()}${path}`;
};

/**
 * Pre-configured base URL for OpenAPI clients
 */
export const BFF_BASE_URL = getBFFBaseUrl();
