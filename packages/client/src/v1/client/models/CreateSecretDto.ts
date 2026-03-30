/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export type CreateSecretDto = {
    /**
     * Unique name for the secret
     */
    name: string;
    /**
     * Human-readable description of the secret
     */
    description?: string;
    /**
     * The secret value (will be encrypted at rest)
     */
    value: string;
};

