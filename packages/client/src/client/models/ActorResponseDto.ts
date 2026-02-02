/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export type ActorResponseDto = {
    /**
     * Unique identifier for the actor
     */
    id: string;
    /**
     * Type of the actor
     */
    type: ActorResponseDto.type;
    /**
     * Unique slug identifier for the actor
     */
    slug: string;
    /**
     * Display name of the actor
     */
    displayName: string;
    /**
     * URL to the actor avatar image
     */
    avatarUrl?: string | null;
};
export namespace ActorResponseDto {
    /**
     * Type of the actor
     */
    export enum type {
        HUMAN = 'human',
        AGENT = 'agent',
    }
}

