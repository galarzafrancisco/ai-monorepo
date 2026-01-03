/**
 * Centralized environment configuration for the backend application.
 *
 * This module provides a single source of truth for all environment variables,
 * with validation and default values. All process.env reads should go through
 * this module to ensure consistency and ease of maintenance.
 */

import { Logger } from '@nestjs/common';

const logger = new Logger('EnvConfig');

export type NodeEnv = 'development' | 'production';
/**
 * Configuration interface for type safety
 */
export interface AppConfig {
  // Server Configuration
  port: number;
  nodeEnv: NodeEnv;

  // Authorization Server URLs
  issuerUrl: string;
  callbackUrl: string;

  // Database Configuration
  databasePath: string;

  // External Services
  adkUrl: string;
  ollamaUrl: string;

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
    nodeEnv: getEnv(),

    // Authorization Server URLs
    issuerUrl: getIssuerUrl(),
    callbackUrl: getCallbackUrl(),

    // Database Configuration
    databasePath: process.env.DATABASE_PATH || 'data/database.sqlite',

    // External Services
    adkUrl: getADKUrl(),
    ollamaUrl: getOllamaUrl(),

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
  logger.log(`  - Callback URL: ${config.callbackUrl}`);
  logger.log(`  - Database Path: ${config.databasePath}`);
  logger.log(`  - ADK URL: ${config.adkUrl}`);
  logger.log(`  - Ollama URL: ${config.ollamaUrl}`);

  return config;
}

function getEnv(): NodeEnv {
  const env = process.env.NODE_ENV;
  if (env === 'production' || env === 'development') {
    return env;
  }
  return 'development';
}

function getIssuerUrl(): string {
  const issuerUrl = process.env.ISSUER_URL;
  if (issuerUrl) {
    return issuerUrl;
  }
  if (getEnv() === 'production') {
    logger.error('ISSUER_URL is not set in production environment');
    throw new Error('ISSUER_URL must be set in production');
  }
  // Default for development
  logger.warn('Using default ISSUER_URL for development');
  return 'http://localhost:3000';
}

function getCallbackUrl(): string {
  const issuerUrl = getIssuerUrl();
  return `${issuerUrl}/api/v1/auth/callback`;
}

function getADKUrl(): string {
  const adkUrl = process.env.ADK_URL;
  if (adkUrl) {
    return adkUrl;
  }
  if (getEnv() === 'production') {
    logger.error('ADK_URL is not set in production environment');
    throw new Error('ADK_URL must be set in production');
  }
  // Default for development
  logger.warn('Using default ADK_URL for development');
  return 'http://localhost:8000';
}

function getOllamaUrl(): string {
  const ollamaUrl = process.env.OLLAMA_URL;
  if (ollamaUrl) {
    return ollamaUrl;
  }
  if (getEnv() === 'production') {
    logger.error('OLLAMA_URL is not set in production environment');
    throw new Error('OLLAMA_URL must be set in production');
  }
  // Default for development
  logger.warn('Using default OLLAMA_URL for development');
  return 'http://localhost:11434';
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
