/** Google Cloud settings read from the server environment, used when a provider stores none. */

export function vertexProjectFromEnv(): string | undefined {
  return process.env.GOOGLE_VERTEX_PROJECT || process.env.GOOGLE_CLOUD_PROJECT || undefined;
}

export function vertexLocationFromEnv(): string | undefined {
  return process.env.GOOGLE_VERTEX_LOCATION || process.env.GOOGLE_CLOUD_LOCATION || undefined;
}

export function googleApiKeyFromEnv(): string | undefined {
  return (
    process.env.GOOGLE_API_KEY ||
    process.env.GEMINI_API_KEY ||
    process.env.GOOGLE_GENERATIVE_AI_API_KEY ||
    undefined
  );
}
