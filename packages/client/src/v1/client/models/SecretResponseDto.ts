/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export type SecretResponseDto = {
    /**
     * Secret identifier
     */
    id: string;
    /**
     * Name of the secret
     */
    name: string;
    /**
     * Human-readable description
     */
    description?: string | null;
    /**
     * ID of the actor who created this secret
     */
    createdByActorId: string;
    /**
     * Slug of the actor who created this secret
     */
    createdBy?: string | null;
    /**
     * Row version for optimistic locking
     */
    rowVersion: number;
    /**
     * ISO timestamp when the secret was created
     */
    createdAt: string;
    /**
     * ISO timestamp when the secret was last updated
     */
    updatedAt: string;
};

