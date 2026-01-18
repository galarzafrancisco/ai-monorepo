/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { ActorResponseDto } from '../models/ActorResponseDto';
import type { CancelablePromise } from '../core/CancelablePromise';
import { OpenAPI } from '../core/OpenAPI';
import { request as __request } from '../core/request';
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
