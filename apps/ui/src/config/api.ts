/**
 * Centralized API configuration for the frontend application.
 *
 * This module provides a single source of truth for backend URL configuration.
 *
 * With Vite proxy configured in development mode, the frontend always uses
 * relative paths for API requests. The proxy handles forwarding requests to
 * the backend server in development, while in production the frontend is
 * served from the same origin as the backend.
 */

/**
 * Get the base URL for API requests
 *
 * @returns Empty string (relative paths) in all environments
 */
export const getBFFBaseUrl = (): string => {
  // Always use relative paths - Vite proxy handles dev mode routing
  return '';
};

/**
 * Get the WebSocket URL for real-time connections
 *
 * WebSockets cannot be proxied by Vite in the same way as HTTP requests,
 * so in development mode we need to construct the full URL to the backend.
 *
 * @param path - The WebSocket path (e.g., "/taskeroo")
 * @returns WebSocket-compatible URL
 */
export const getUIWebSocketUrl = (path: string): string => {
  if (import.meta.env.PROD) {
    return path;
  }
  // In dev mode, construct full URL since WebSockets can't use Vite proxy
  const backendPort = import.meta.env.VITE_BACKEND_PORT || 3000;
  return `http://localhost:${backendPort}${path}`;
};

/**
 * Pre-configured base URL for OpenAPI clients
 */
export const BFF_BASE_URL = getBFFBaseUrl();
