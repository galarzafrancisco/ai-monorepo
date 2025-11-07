/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { ClientRegistrationResponseDto } from '../models/ClientRegistrationResponseDto';
import type { ConsentDecisionDto } from '../models/ConsentDecisionDto';
import type { McpAuthorizationFlowEntity } from '../models/McpAuthorizationFlowEntity';
import type { RegisterClientDto } from '../models/RegisterClientDto';
import type { CancelablePromise } from '../core/CancelablePromise';
import { OpenAPI } from '../core/OpenAPI';
import { request as __request } from '../core/request';
export class AuthorizationServerService {
    /**
     * Register a new OAuth 2.0 client (Dynamic Client Registration)
     * Implements RFC 7591 Dynamic Client Registration for OAuth 2.0. Validates client metadata, generates credentials, and persists the client configuration. Requires authorization_code and refresh_token grant types with PKCE support per MCP specification.
     * @param serverId
     * @param version
     * @param requestBody
     * @returns ClientRegistrationResponseDto Client registered successfully with generated credentials
     * @throws ApiError
     */
    public static clientRegistrationControllerRegisterClient(
        serverId: string,
        version: string,
        requestBody: RegisterClientDto,
    ): CancelablePromise<ClientRegistrationResponseDto> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/v1/auth/clients/register/mcp/{serverId}/{version}',
            path: {
                'serverId': serverId,
                'version': version,
            },
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                400: `Invalid client metadata (missing fields, invalid redirect URIs, unsupported grant types, or PKCE not configured)`,
                409: `A client with this name is already registered`,
            },
        });
    }
    /**
     * Retrieve client registration information
     * Returns the registration metadata for a client. The client_secret is NOT included in the response for security reasons.
     * @param clientId
     * @returns ClientRegistrationResponseDto Client registration information retrieved successfully
     * @throws ApiError
     */
    public static clientRegistrationControllerGetClient(
        clientId: string,
    ): CancelablePromise<ClientRegistrationResponseDto> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/v1/auth/clients/{clientId}',
            path: {
                'clientId': clientId,
            },
            errors: {
                404: `Client not found`,
            },
        });
    }
    /**
     * List all registered clients (Admin)
     * Returns a list of all registered OAuth clients. Intended for administrative purposes. Client secrets are not included.
     * @returns ClientRegistrationResponseDto List of registered clients
     * @throws ApiError
     */
    public static clientRegistrationControllerListClients(): CancelablePromise<Array<ClientRegistrationResponseDto>> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/v1/auth/clients',
        });
    }
    /**
     * OAuth 2.0 Authorization Endpoint
     * Handles authorization requests from MCP clients. Validates the request, stores PKCE parameters, and redirects to the consent screen UI.
     * @param responseType OAuth 2.0 response type (must be "code" for authorization code flow)
     * @param clientId Client identifier issued during registration
     * @param codeChallenge PKCE code challenge derived from the code verifier
     * @param codeChallengeMethod PKCE code challenge method (S256 for SHA-256)
     * @param redirectUri Redirect URI where the authorization response will be sent
     * @param state Opaque state value for CSRF protection
     * @param resource Resource server URL that the client wants to access
     * @param serverIdentifier
     * @param version
     * @returns void
     * @throws ApiError
     */
    public static authorizationControllerAuthorize(
        responseType: 'code',
        clientId: string,
        codeChallenge: string,
        codeChallengeMethod: string,
        redirectUri: string,
        state: string,
        resource: string,
        serverIdentifier: string,
        version: string,
    ): CancelablePromise<void> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/v1/auth/authorize/mcp/{serverIdentifier}/{version}',
            path: {
                'serverIdentifier': serverIdentifier,
                'version': version,
            },
            query: {
                'response_type': responseType,
                'client_id': clientId,
                'code_challenge': codeChallenge,
                'code_challenge_method': codeChallengeMethod,
                'redirect_uri': redirectUri,
                'state': state,
                'resource': resource,
            },
            errors: {
                302: `Redirects to consent screen with authorization request ID`,
                400: `Invalid authorization request parameters`,
                404: `MCP server or client not found`,
            },
        });
    }
    /**
     * OAuth 2.0 Authorization Consent Handler
     * Handles user consent decision. Validates the flow ID (CSRF token), generates an authorization code if approved, and redirects back to the client with the code or error.
     * @param serverIdentifier
     * @param version
     * @param requestBody
     * @returns void
     * @throws ApiError
     */
    public static authorizationControllerAuthorizeConsent(
        serverIdentifier: string,
        version: string,
        requestBody: ConsentDecisionDto,
    ): CancelablePromise<void> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/v1/auth/authorize/mcp/{serverIdentifier}/{version}',
            path: {
                'serverIdentifier': serverIdentifier,
                'version': version,
            },
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                302: `Redirects to client redirect_uri with authorization code or error`,
                400: `Invalid consent decision or flow state`,
                401: `Authorization flow has already been used`,
                404: `Authorization flow not found`,
            },
        });
    }
    /**
     * Get authorization flow details
     * Retrieves authorization flow details for the consent screen
     * @param flowId
     * @returns McpAuthorizationFlowEntity Authorization flow details retrieved successfully
     * @throws ApiError
     */
    public static authorizationControllerGetFlow(
        flowId: string,
    ): CancelablePromise<McpAuthorizationFlowEntity> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/v1/auth/flow/{flowId}',
            path: {
                'flowId': flowId,
            },
            errors: {
                404: `Authorization flow not found`,
            },
        });
    }
}
