/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { ClientRegistrationResponseDto } from '../models/ClientRegistrationResponseDto';
import type { RegisterClientDto } from '../models/RegisterClientDto';
import type { CancelablePromise } from '../core/CancelablePromise';
import { OpenAPI } from '../core/OpenAPI';
import { request as __request } from '../core/request';
export class AuthorizationServerService {
    /**
     * Register a new OAuth 2.0 client (Dynamic Client Registration)
     * Implements RFC 7591 Dynamic Client Registration for OAuth 2.0. Validates client metadata, generates credentials, and persists the client configuration. Requires authorization_code and refresh_token grant types with PKCE support per MCP specification.
     * @param requestBody
     * @returns ClientRegistrationResponseDto Client registered successfully with generated credentials
     * @throws ApiError
     */
    public static clientRegistrationControllerRegisterClient(
        requestBody: RegisterClientDto,
    ): CancelablePromise<ClientRegistrationResponseDto> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/v1/auth/clients/register/mcp/{serverId}/{version}',
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
}
