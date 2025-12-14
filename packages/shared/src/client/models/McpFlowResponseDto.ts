/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export type McpFlowResponseDto = {
    /**
     * System-generated UUID for the MCP authorization flow
     */
    id: string;
    /**
     * UUID of the authorization journey this flow belongs to
     */
    authorizationJourneyId: string;
    /**
     * UUID of the MCP server
     */
    serverId: string;
    /**
     * UUID of the registered MCP client
     */
    clientId: string;
    /**
     * Client name for display
     */
    clientName?: string | null;
    /**
     * Current status of the MCP authorization flow
     */
    status: McpFlowResponseDto.status;
    /**
     * Scopes requested by the client
     */
    scope?: string | null;
    /**
     * When the authorization code expires
     */
    authorizationCodeExpiresAt?: string | null;
    /**
     * Whether the authorization code has been used
     */
    authorizationCodeUsed: boolean;
    /**
     * Timestamp when the flow was created
     */
    createdAt: string;
    /**
     * Timestamp when the flow was last updated
     */
    updatedAt: string;
};
export namespace McpFlowResponseDto {
    /**
     * Current status of the MCP authorization flow
     */
    export enum status {
        CLIENT_NOT_REGISTERED = 'CLIENT_NOT_REGISTERED',
        CLIENT_REGISTERED = 'CLIENT_REGISTERED',
        AUTHORIZATION_REQUEST_STARTED = 'AUTHORIZATION_REQUEST_STARTED',
        USER_CONSENT_OK = 'USER_CONSENT_OK',
        USER_CONSENT_REJECTED = 'USER_CONSENT_REJECTED',
        WAITING_ON_DOWNSTREAM_AUTH = 'WAITING_ON_DOWNSTREAM_AUTH',
        AUTHORIZATION_CODE_ISSUED = 'AUTHORIZATION_CODE_ISSUED',
        AUTHORIZATION_CODE_EXCHANGED = 'AUTHORIZATION_CODE_EXCHANGED',
    }
}

