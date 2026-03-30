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
     * API key for the chat provider. If provided, a secret will be created automatically.
     */
    apiKey?: string;
};

