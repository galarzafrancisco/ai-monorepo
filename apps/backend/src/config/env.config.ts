/**
 * Centralized environment configuration for the backend application.
 *
 * This module provides a single source of truth for all environment variables,
 * with validation and default values. All process.env reads should go through
 * this module to ensure consistency and ease of maintenance.
 */

import { Logger } from '@nestjs/common';

const logger = new Logger('EnvConfig');

/**
 * Configuration interface for type safety
 */
export interface AppConfig {
  // Server Configuration
  port: number;
  nodeEnv: string;

  // Authorization Server URLs
  issuerUrl: string;
  callbackBaseUrl: string;

  // Database Configuration
  databasePath: string;

  // External Services
  adkUrl: string;
  ollamaHost: string;

  // Security Configuration
  clientSecretLength: number;
  jwksKeyTtlHours: number;

  // Development Configuration
  vitePort: string;
}

/**
 * Load and validate environment configuration
 * This should be called once at application startup
 */
export function loadConfig(): AppConfig {
  const config: AppConfig = {
    // Server Configuration
    port: parseInt(process.env.BACKEND_PORT || '3000', 10),
    nodeEnv: process.env.NODE_ENV || 'development',

    // Authorization Server URLs
    issuerUrl: process.env.ISSUER_URL || getDefaultIssuerUrl(),
    callbackBaseUrl: process.env.CALLBACK_BASE_URL || getDefaultCallbackUrl(),

    // Database Configuration
    databasePath: process.env.DATABASE_PATH || 'data/database.sqlite',

    // External Services
    adkUrl: process.env.ADK_URL || 'http://localhost:8000',
    ollamaHost: process.env.OLLAMA_HOST || 'http://localhost:11434',

    // Security Configuration
    clientSecretLength: parseInt(process.env.CLIENT_SECRET_LENGTH || '32', 10),
    jwksKeyTtlHours: parseInt(process.env.JWKS_KEY_TTL_HOURS || '24', 10),

    // Development Configuration
    vitePort: process.env.VITE_PORT || '5173',
  };

  // Log configuration (excluding sensitive data)
  logger.log('Configuration loaded:');
  logger.log(`  - Port: ${config.port}`);
  logger.log(`  - Node Environment: ${config.nodeEnv}`);
  logger.log(`  - Issuer URL: ${config.issuerUrl}`);
  logger.log(`  - Callback Base URL: ${config.callbackBaseUrl}`);
  logger.log(`  - Database Path: ${config.databasePath}`);
  logger.log(`  - ADK URL: ${config.adkUrl}`);
  logger.log(`  - Ollama Host: ${config.ollamaHost}`);

  return config;
}

/**
 * Get default issuer URL based on environment
 */
function getDefaultIssuerUrl(): string {
  if (process.env.NODE_ENV === 'production') {
    logger.warn('ISSUER_URL not set in production, using default. This should be configured!');
    return 'http://localhost:3000';
  }
  return 'http://localhost:3000';
}

/**
 * Get default callback URL based on environment
 */
function getDefaultCallbackUrl(): string {
  if (process.env.NODE_ENV === 'production') {
    logger.warn('CALLBACK_BASE_URL not set in production, using default. This should be configured!');
    return 'http://localhost:3000';
  }
  return 'http://localhost:3000';
}

/**
 * Singleton instance of configuration
 * Load once and reuse throughout the application
 */
let configInstance: AppConfig | null = null;

/**
 * Get the application configuration
 * Loads config on first call, returns cached instance on subsequent calls
 */
export function getConfig(): AppConfig {
  if (!configInstance) {
    configInstance = loadConfig();
  }
  return configInstance;
}

/**
 * Helper functions for common checks
 */
export function isDevelopment(): boolean {
  return getConfig().nodeEnv !== 'production';
}

export function isProduction(): boolean {
  return getConfig().nodeEnv === 'production';
}
