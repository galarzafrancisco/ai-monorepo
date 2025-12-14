/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export type ConnectionFlowResponseDto = {
    /**
     * System-generated UUID for the connection authorization flow
     */
    id: string;
    /**
     * UUID of the authorization journey this flow belongs to
     */
    authorizationJourneyId: string;
    /**
     * UUID of the MCP connection this flow uses
     */
    mcpConnectionId: string;
    /**
     * Connection friendly name
     */
    connectionName?: Record<string, any> | null;
    /**
     * Current status of the connection flow
     */
    status: ConnectionFlowResponseDto.status;
    /**
     * When the access token expires
     */
    tokenExpiresAt?: Record<string, any> | null;
    /**
     * Timestamp when the flow was created
     */
    createdAt: string;
    /**
     * Timestamp when the flow was last updated
     */
    updatedAt: string;
};
export namespace ConnectionFlowResponseDto {
    /**
     * Current status of the connection flow
     */
    export enum status {
        PENDING = 'pending',
        AUTHORIZED = 'authorized',
        FAILED = 'failed',
    }
}

