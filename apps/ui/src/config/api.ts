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

import { OpenAPI } from 'shared';

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
 * With Vite proxy configured for Socket.IO WebSockets (ws: true on /socket.io),
 * the frontend can use relative paths for WebSocket connections in all environments.
 *
 * @param path - The WebSocket path (e.g., "/taskeroo")
 * @returns WebSocket-compatible URL (relative path)
 */
export const getUIWebSocketUrl = (path: string): string => {
  // Always use relative paths - Vite proxy handles WebSocket routing in dev mode
  return path;
};

/**
 * Pre-configured base URL for OpenAPI clients
 */
export const BFF_BASE_URL = getBFFBaseUrl();

/**
 * Configure OpenAPI client to send cookies with all requests
 * This ensures authentication tokens stored in httpOnly cookies are sent automatically
 */
OpenAPI.BASE = BFF_BASE_URL;
OpenAPI.CREDENTIALS = 'include';
