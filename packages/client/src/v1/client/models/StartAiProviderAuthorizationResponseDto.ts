/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export type StartAiProviderAuthorizationResponseDto = {
    /**
     * Address to open in the browser to sign in at the provider
     */
    authorizationUrl: string;
    /**
     * ISO timestamp after which this sign-in can no longer be finished
     */
    expiresAt: string;
};

