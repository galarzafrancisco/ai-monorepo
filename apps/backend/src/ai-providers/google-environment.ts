/** Google Cloud settings read from the server environment, used when a provider stores none. */

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
