/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { CancelablePromise } from '../core/CancelablePromise';
import { OpenAPI } from '../core/OpenAPI';
import { request as __request } from '../core/request';
export class JwksService {
    /**
     * Get JSON Web Key Set (JWKS)
     * Returns the public keys used to verify JWT signatures. This endpoint provides all valid (non-expired) keys to support key rotation.
     * @returns any JWKS retrieved successfully
     * @throws ApiError
     */
    public static jwksControllerGetJwks(): CancelablePromise<{
        keys?: Array<{
            kty?: string;
            use?: string;
            kid?: string;
            alg?: string;
            'n'?: string;
            'e'?: string;
        }>;
    }> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/.well-known/jwks.json',
        });
    }
}
