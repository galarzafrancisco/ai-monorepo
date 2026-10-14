/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export type AiProviderConnectionResponseDto = {
    /**
     * AI provider identifier
     */
    aiProviderId: string;
    /**
     * State of your own connection to the provider
     */
    status: AiProviderConnectionResponseDto.status;
    /**
     * Email of the connected account
     */
    accountEmail?: string | null;
    /**
     * Whether requests can run on your plan right now
     */
    canUsePlan: boolean;
    /**
     * Whether turns nobody typed (task updates) may run on your plan
     */
    automatedTurnsAllowed: boolean;
    /**
     * Whether a sign-in was started and not finished
     */
    isAuthorizationPending: boolean;
    /**
     * The provider's code for the last failed request, cleared by the next success
     */
    lastErrorCode?: string | null;
    /**
     * ISO timestamp of the last failed request
     */
    lastErrorAt?: string | null;
    /**
     * Where you see and manage your plan usage
     */
    manageUsageUrl: string;
};
export namespace AiProviderConnectionResponseDto {
    /**
     * State of your own connection to the provider
     */
    export enum status {
        CONNECTED = 'connected',
        PLAN_ACCESS_NOT_GRANTED = 'plan_access_not_granted',
        NEEDS_REAUTHORIZATION = 'needs_reauthorization',
        DISCONNECTED = 'disconnected',
    }
}

