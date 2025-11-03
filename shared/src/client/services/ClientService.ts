/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { ClientDto } from '../models/ClientDto';
import type { CreateClientDto } from '../models/CreateClientDto';
import type { ListClientsResponseDto } from '../models/ListClientsResponseDto';
import type { UpdateClientDto } from '../models/UpdateClientDto';
import type { CancelablePromise } from '../core/CancelablePromise';
import { OpenAPI } from '../core/OpenAPI';
import { request as __request } from '../core/request';
export class ClientService {
    /**
     * List all clients
     * @returns ListClientsResponseDto Successfully retrieved list of clients
     * @throws ApiError
     */
    public static clientControllerListClients(): CancelablePromise<ListClientsResponseDto> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/clients',
        });
    }
    /**
     * Create a new client
     * @param requestBody
     * @returns ClientDto Successfully created a new client
     * @throws ApiError
     */
    public static clientControllerCreateClient(
        requestBody: CreateClientDto,
    ): CancelablePromise<ClientDto> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/clients',
            body: requestBody,
            mediaType: 'application/json',
        });
    }
    /**
     * Get a client by ID
     * @param id The unique identifier of the client
     * @returns ClientDto Successfully retrieved client
     * @throws ApiError
     */
    public static clientControllerGetClientById(
        id: string,
    ): CancelablePromise<ClientDto> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/clients/{id}',
            path: {
                'id': id,
            },
            errors: {
                404: `Client not found`,
            },
        });
    }
    /**
     * Update a client
     * @param id The unique identifier of the client
     * @param requestBody
     * @returns ClientDto Successfully updated client
     * @throws ApiError
     */
    public static clientControllerUpdateClient(
        id: string,
        requestBody: UpdateClientDto,
    ): CancelablePromise<ClientDto> {
        return __request(OpenAPI, {
            method: 'PATCH',
            url: '/clients/{id}',
            path: {
                'id': id,
            },
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                404: `Client not found`,
            },
        });
    }
    /**
     * Delete a client
     * @param id The unique identifier of the client
     * @returns void
     * @throws ApiError
     */
    public static clientControllerDeleteClient(
        id: string,
    ): CancelablePromise<void> {
        return __request(OpenAPI, {
            method: 'DELETE',
            url: '/clients/{id}',
            path: {
                'id': id,
            },
            errors: {
                404: `Client not found`,
            },
        });
    }
}
