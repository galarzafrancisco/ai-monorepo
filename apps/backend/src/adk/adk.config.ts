/**
 * ADK (Agent Development Kit) configuration
 *
 * Provides the base URL for the ADK agent API service.
 * The URL is configurable via environment variable with a sensible default.
 */

/**
 * Get the ADK API base URL
 *
 * @returns The base URL for the ADK agent API (defaults to http://localhost:8000)
 */
export function getAdkBaseUrl(): string {
  return process.env.ADK_URL || 'http://localhost:8000';
}
