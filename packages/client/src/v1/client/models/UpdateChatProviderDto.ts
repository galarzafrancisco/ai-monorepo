/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export type UpdateChatProviderDto = {
    /**
     * Display name for the chat provider
     */
    name?: string;
    /**
     * ID of the secret containing the API key
     */
    secretId?: string;
    /**
     * API key for the chat provider, or service account JSON for Vertex AI. If provided, a secret will be created automatically.
     */
    apiKey?: string;
    /**
     * Model to use with this provider. Blank uses the provider default.
     */
    modelId?: string | null;
    /**
     * API base URL. Required for OpenAI-compatible providers.
     */
    baseUrl?: string | null;
    /**
     * Google Cloud project for Vertex AI. Blank falls back to the environment.
     */
    project?: string | null;
    /**
     * Google Cloud location for Vertex AI. Blank falls back to the environment.
     */
    location?: string | null;
};

