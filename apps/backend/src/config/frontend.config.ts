/**
 * Centralized frontend URL configuration for the backend application.
 *
 * This module provides a single source of truth for frontend URL configuration,
 * handling both production and development environments.
 *
 * - In production: Frontend is served from the same origin (relative paths)
 * - In development: Frontend runs on a different port (absolute URLs)
 */

import { getConfig, isDevelopment } from './env.config';

/**
 * Get the frontend base URL for redirects and links
 *
 * @returns Relative path "/" in production, "http://localhost:{port}" in development
 */
export function getFrontendUrl(): string {
  // In development, frontend runs on a different port
  if (isDevelopment()) {
    const config = getConfig();
    return `http://localhost:${config.vitePort}`;
  }

  // In production, frontend is served from the same origin
  return '';
}

/**
 * Get a full frontend URL for a specific path
 *
 * @param path - The path to append (e.g., "/consent", "/dashboard")
 * @returns Full URL in development, relative path in production
 */
export function getFrontendPath(path: string): string {
  const baseUrl = getFrontendUrl();
  console.log(`Frontend base url: ${baseUrl}`)

  // Ensure path starts with /
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;

  return `${baseUrl}${normalizedPath}`;
}

// Re-export environment checks from env.config for convenience
export { isDevelopment, isProduction } from './env.config';
