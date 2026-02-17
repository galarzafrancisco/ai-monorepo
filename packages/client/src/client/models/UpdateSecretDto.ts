/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export type UpdateSecretDto = {
    /**
     * New name for the secret
     */
    name?: string;
    /**
     * New description for the secret
     */
    description?: string | null;
    /**
     * New secret value (will be encrypted at rest)
     */
    value?: string;
};

