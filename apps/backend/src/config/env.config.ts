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

  // Security Configuration
  clientSecretLength: number;
  jwksKeySigningTtlHours: number;
  jwksKeyVerifyingTtlHours: number;

  // Token Duration Configuration (in seconds)
  mcpAccessTokenDurationSeconds: number;
  mcpRefreshTokenDurationDays: number;
  webAccessTokenDurationMinutes: number;
  webRefreshTokenDurationDays: number;

  // Cleanup Configuration
  mcpClientPruneRetentionHours: number;

  // Development Configuration
  vitePort: string;
}

/**
 * Load and validate environment configuration
 * This should be called once at application startup
 */
export function loadConfig(): AppConfig {
  const backendPortValue =
    process.env.BACKEND_PORT || '3000';
  const uiPort = getUiPort();

  const config: AppConfig = {
    // Server Configuration
    port: parseInt(backendPortValue, 10),
    nodeEnv: getEnv(),

    // Authorization Server URLs
    issuerUrl: getIssuerUrl(),
    callbackUrl: getCallbackUrl(),

    // Database Configuration
    databasePath: process.env.DATABASE_PATH || 'data/database.sqlite',

    // Security Configuration
    clientSecretLength: parseInt(process.env.CLIENT_SECRET_LENGTH || '32', 10),
    jwksKeySigningTtlHours: parseInt(
      process.env.JWKS_KEY_SIGNING_TTL_HOURS || '72',
      10,
    ),
    jwksKeyVerifyingTtlHours: parseInt(
      process.env.JWKS_KEY_VERIFYING_TTL_HOURS || '1440',
      10,
    ), // 60 days default

    // Token Duration Configuration
    // MCP access token: 10 minutes initially (for testing), increase to 1 hour in production
    mcpAccessTokenDurationSeconds: parseInt(
      process.env.MCP_ACCESS_TOKEN_DURATION_SECONDS || '600',
      10,
    ),
    // MCP refresh token: 7 days
    mcpRefreshTokenDurationDays: parseInt(
      process.env.MCP_REFRESH_TOKEN_DURATION_DAYS || '7',
      10,
    ),
    // Web access token: 60 minutes
    webAccessTokenDurationMinutes: parseInt(
      process.env.WEB_ACCESS_TOKEN_DURATION_MINUTES || '60',
      10,
    ),
    // Web refresh token: 1 day
    webRefreshTokenDurationDays: parseInt(
      process.env.WEB_REFRESH_TOKEN_DURATION_DAYS || '1',
      10,
    ),

    // Cleanup Configuration
    mcpClientPruneRetentionHours: parseFloat(process.env.MCP_CLIENT_PRUNE_RETENTION_HOURS || '0.75'),

    // Development Configuration
    vitePort: uiPort,
  };

  // Log configuration (excluding sensitive data)
  logger.log('Configuration loaded:');
  logger.log(`  - Port: ${config.port}`);
  logger.log(`  - Node Environment: ${config.nodeEnv}`);
  logger.log(`  - Issuer URL: ${config.issuerUrl}`);
  logger.log(`  - Callback URL: ${config.callbackUrl}`);
  logger.log(`  - Database Path: ${config.databasePath}`);
  logger.log(`  - MCP Client Prune Retention Hours: ${config.mcpClientPruneRetentionHours}`);

  return config;
}

function getEnv(): NodeEnv {
  const env = process.env.NODE_ENV;
  if (env === 'production' || env === 'development') {
    return env;
  }
  return 'development';
}

function getUiPort(): string {
  return process.env.UI_PORT || '2000';
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
  return `http://localhost:${getUiPort()}`;
}

function getCallbackUrl(): string {
  const issuerUrl = getIssuerUrl();
  return `${issuerUrl}/api/v1/auth/callback`;
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

/**
 * Feature flag: Secrets module.
 * Off by default. Enable by setting SECRETS_ENABLED=true in the environment.
 * When disabled, the app starts without requiring SECRETS_ENCRYPTION_KEY.
 */
export function isSecretsEnabled(): boolean {
  return process.env.SECRETS_ENABLED === 'true';
}
