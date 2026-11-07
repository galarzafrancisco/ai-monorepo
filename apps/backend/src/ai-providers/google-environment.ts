import { DEFAULT_WORKSPACE_ID } from '../workspaces/workspaces.constants';
import type { AiProviderConfigResult } from './dto/service/ai-providers.service.types';
import { AiProviderNotConfiguredError } from './errors/ai-providers.errors';

/**
 * Google credentials and settings from the server environment (API keys,
 * project, location, application default credentials) are the installation's,
 * and the installation's AI models live in the default workspace. Only its
 * providers may fall back to them. Any other workspace must store its own
 * credentials: its admin can point a provider at any URL, so a fallback would
 * hand the server's key to another company.
 */
export function mayUseServerCredentials(workspaceId: string): boolean {
  return workspaceId === DEFAULT_WORKSPACE_ID;
}

export function vertexProjectFromEnv(): string | undefined {
  return process.env.GOOGLE_VERTEX_PROJECT || process.env.GOOGLE_CLOUD_PROJECT || undefined;
}

export function vertexLocationFromEnv(): string | undefined {
  return process.env.GOOGLE_VERTEX_LOCATION || process.env.GOOGLE_CLOUD_LOCATION || undefined;
}

/**
 * Vertex AI serves Anthropic's Claude models under a different publisher and
 * API from Gemini. Claude model ids on Vertex all start with `claude-`.
 */
export function isVertexAnthropicModelId(modelId: string): boolean {
  return /^claude-/i.test(modelId);
}

export function googleApiKeyFromEnv(): string | undefined {
  return (
    process.env.GOOGLE_API_KEY ||
    process.env.GEMINI_API_KEY ||
    process.env.GOOGLE_GENERATIVE_AI_API_KEY ||
    undefined
  );
}

/**
 * The API key to hand an AI SDK. Never undefined: the OpenAI, Anthropic, xAI
 * and Google SDKs would then read their own key from the server environment.
 */
export function requireApiKey(config: AiProviderConfigResult): string {
  if (!config.apiKey) {
    throw new AiProviderNotConfiguredError(config.id);
  }
  return config.apiKey;
}

export type VertexSettings = {
  project: string | undefined;
  location: string | undefined;
  googleAuthOptions: { credentials: Record<string, unknown> } | undefined;
  /**
   * Set to an empty string when the provider may not use server credentials,
   * so the Gemini SDK does not pick up GOOGLE_VERTEX_API_KEY. The Anthropic
   * SDK on Vertex has no such fallback and takes no key.
   */
  apiKey?: string;
};

/**
 * The Vertex AI SDK settings for a provider. Its stored service account,
 * project and location are used; without them, only a provider that may use
 * server credentials falls back to application default credentials.
 */
export function vertexSettings(config: AiProviderConfigResult): VertexSettings {
  let credentials: Record<string, unknown> | undefined;
  if (config.apiKey) {
    try {
      credentials = JSON.parse(config.apiKey);
    } catch {
      throw new AiProviderNotConfiguredError(config.id);
    }
  }

  if (!config.serverCredentials && (!credentials || !config.project || !config.location)) {
    throw new AiProviderNotConfiguredError(config.id);
  }

  return {
    project: config.project ?? undefined,
    location: config.location ?? undefined,
    googleAuthOptions: credentials ? { credentials } : undefined,
    ...(config.serverCredentials ? {} : { apiKey: '' }),
  };
}
