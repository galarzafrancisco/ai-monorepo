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
};
export namespace CreateChatProviderDto {
    /**
     * Type of chat provider
     */
    export enum type {
        OPENAI = 'openai',
    }
}

