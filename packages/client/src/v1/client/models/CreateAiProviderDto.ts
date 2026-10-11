/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export type CreateAiProviderDto = {
    /**
     * Display name for the AI provider
     */
    name: string;
    /**
     * Type of AI provider
     */
    type: CreateAiProviderDto.type;
    /**
     * ID of the secret containing the API key
     */
    secretId?: string;
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
export namespace CreateAiProviderDto {
    /**
     * Type of AI provider
     */
    export enum type {
        OPENAI = 'openai',
        ANTHROPIC = 'anthropic',
        GOOGLE = 'google',
        GOOGLE_VERTEX = 'google_vertex',
        XAI = 'xai',
        OPENAI_COMPATIBLE = 'openai_compatible',
    }
}

