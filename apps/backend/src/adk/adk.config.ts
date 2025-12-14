/**
 * ADK (Agent Development Kit) configuration
 *
 * Provides the base URL for the ADK agent API service.
 * The URL is configured through the centralized environment configuration.
 */

import { getConfig } from '../config/env.config';

/**
 * Get the ADK API base URL
 *
 * @returns The base URL for the ADK agent API (defaults to http://localhost:8000)
 */
export function getAdkBaseUrl(): string {
  return getConfig().adkUrl;
}
