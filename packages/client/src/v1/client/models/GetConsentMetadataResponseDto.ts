/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { FlowClientDto } from './FlowClientDto.js';
import type { FlowServerDto } from './FlowServerDto.js';
import type { FlowWorkspaceDto } from './FlowWorkspaceDto.js';
export type GetConsentMetadataResponseDto = {
    /**
     * Unique identifier of the authorization flow
     */
    id: string;
    /**
     * Current status of the authorization flow
     */
    status: GetConsentMetadataResponseDto.status;
    /**
     * List of scopes being requested
     */
    scopes?: Array<string>;
    /**
     * Resource URL the client wants to access
     */
    resource?: string;
    /**
     * MCP server the client is requesting access to
     */
    server: FlowServerDto;
    /**
     * Client application requesting authorization
     */
    client: FlowClientDto;
    /**
     * The workspace the token will work in: for Taico's own servers (tasks, context, workers), the workspace the person is in now; for any other server, the server's workspace.
     */
    workspace: FlowWorkspaceDto;
    /**
     * Redirect URI provided in the authorization request
     */
    redirectUri: string;
    /**
     * Timestamp when the flow was created
     */
    createdAt: string;
};
export namespace GetConsentMetadataResponseDto {
    /**
     * Current status of the authorization flow
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

