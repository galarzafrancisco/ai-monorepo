/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { ActorResponseDto } from '../models/ActorResponseDto.js';
import type { CancelablePromise } from '../core/CancelablePromise.js';
import { OpenAPI } from '../core/OpenAPI.js';
import { request as __request } from '../core/request.js';
export class ActorsService {
    /**
     * List all actors (users and agents)
     * @returns ActorResponseDto List of all actors
     * @throws ApiError
     */
    public static actorControllerListActors(): CancelablePromise<Array<ActorResponseDto>> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/v1/actors',
        });
    }
}
