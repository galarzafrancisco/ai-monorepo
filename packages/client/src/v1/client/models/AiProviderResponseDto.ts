/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export type AiProviderResponseDto = {
    /**
     * AI provider identifier
     */
    id: string;
    /**
     * Display name of the AI provider
     */
    name: string;
    /**
     * Type of AI provider
     */
    type: AiProviderResponseDto.type;
    /**
     * ID of the secret containing the API key
     */
    secretId?: string | null;
    /**
     * API base URL
     */
    baseUrl?: string | null;
    /**
     * Google Cloud project for Vertex AI
     */
    project?: string | null;
    /**
     * Google Cloud location for Vertex AI
     */
    location?: string | null;
    /**
     * Whether this provider has all required configuration
     */
    isConfigured: boolean;
    /**
     * Row version for optimistic locking
     */
    rowVersion: number;
    /**
     * ISO timestamp when the provider was created
     */
    createdAt: string;
    /**
     * ISO timestamp when the provider was last updated
     */
    updatedAt: string;
};
export namespace AiProviderResponseDto {
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

