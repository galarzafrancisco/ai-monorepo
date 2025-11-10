/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { JwksResponseDto } from '../models/JwksResponseDto';
import type { CancelablePromise } from '../core/CancelablePromise';
import { OpenAPI } from '../core/OpenAPI';
import { request as __request } from '../core/request';
export class JwksService {
    /**
     * Get JSON Web Key Set (JWKS)
     * Returns the public keys used to verify JWT signatures. This endpoint provides all valid (non-expired) keys to support key rotation.
     * @returns JwksResponseDto JWKS retrieved successfully
     * @throws ApiError
     */
    public static jwksControllerGetJwks(): CancelablePromise<JwksResponseDto> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/.well-known/jwks.json',
        });
    }
    /**
     * Get Active Signing Key (Single JWK)
     * Returns the currently active signing key as a single JWK. Useful for debugging and testing JWT verification with tools like jwt.io. This endpoint returns only the current signing key, not the full key set.
     * @returns any Active JWK retrieved successfully
     * @throws ApiError
     */
    public static jwksControllerGetActiveJwk(): CancelablePromise<any> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/.well-known/jwk-active.json',
        });
    }
}
