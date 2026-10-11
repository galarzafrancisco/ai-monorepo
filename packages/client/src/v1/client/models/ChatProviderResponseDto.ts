/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export type ChatProviderResponseDto = {
    /**
     * Chat provider identifier
     */
    id: string;
    /**
     * Display name of the chat provider
     */
    name: string;
    /**
     * Type of chat provider
     */
    type: ChatProviderResponseDto.type;
    /**
     * ID of the secret containing the API key
     */
    secretId?: string | null;
    /**
     * Model used with this provider
     */
    modelId?: string | null;
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
     * Whether this provider is currently active
     */
    isActive: boolean;
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
export namespace ChatProviderResponseDto {
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

