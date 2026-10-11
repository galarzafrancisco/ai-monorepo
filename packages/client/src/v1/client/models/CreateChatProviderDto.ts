/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export type CreateChatProviderDto = {
    /**
     * Display name for the chat provider
     */
    name: string;
    /**
     * Type of chat provider
     */
    type: CreateChatProviderDto.type;
    /**
     * ID of the secret containing the API key
     */
    secretId?: string;
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
export namespace CreateChatProviderDto {
    /**
     * Type of chat provider
     */
    export enum type {
        OPENAI = 'openai',
        ANTHROPIC = 'anthropic',
        GOOGLE = 'google',
        GOOGLE_VERTEX = 'google_vertex',
        OPENAI_COMPATIBLE = 'openai_compatible',
        ADK = 'adk',
    }
}

