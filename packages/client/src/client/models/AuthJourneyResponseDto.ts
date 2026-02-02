/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { ActorResponseDto } from './ActorResponseDto.js';
import type { ConnectionFlowResponseDto } from './ConnectionFlowResponseDto.js';
import type { McpFlowResponseDto } from './McpFlowResponseDto.js';
export type AuthJourneyResponseDto = {
    /**
     * System-generated UUID for the authorization journey
     */
    id: string;
    /**
     * Current status of the authorization journey
     */
    status: AuthJourneyResponseDto.status;
    /**
     * The actor (user) associated with this authorization journey
     */
    actor: ActorResponseDto | null;
    /**
     * The MCP authorization flow for this journey
     */
    mcpAuthorizationFlow: McpFlowResponseDto;
    /**
     * Connection authorization flows for this journey
     */
    connectionAuthorizationFlows: Array<ConnectionFlowResponseDto>;
    /**
     * Timestamp when the journey was created
     */
    createdAt: string;
    /**
     * Timestamp when the journey was last updated
     */
    updatedAt: string;
};
export namespace AuthJourneyResponseDto {
    /**
     * Current status of the authorization journey
     */
    export enum status {
        NOT_STARTED = 'not_started',
        USER_CONSENT_REJECTED = 'USER_CONSENT_REJECTED',
        MCP_AUTH_FLOW_STARTED = 'mcp_auth_flow_started',
        MCP_AUTH_FLOW_COMPLETED = 'mcp_auth_flow_completed',
        CONNECTIONS_FLOW_STARTED = 'connections_flow_started',
        CONNECTIONS_FLOW_COMPLETED = 'connections_flow_completed',
        AUTHORIZATION_CODE_ISSUED = 'authorization_code_issued',
        AUTHORIZATION_CODE_EXCHANGED = 'authorization_code_exchanged',
    }
}

