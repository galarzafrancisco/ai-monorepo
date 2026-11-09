/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export type SetupManagedUserRequestDto = {
    /**
     * Invited or reset account email address
     */
    email: string;
    /**
     * The one-time setup code given when the account was created or reset (from the setup link). The email alone is never enough.
     */
    code: string;
    /**
     * Display name for the user
     */
    displayName: string;
    /**
     * Slug/username for the user
     */
    slug: string;
    /**
     * New password for the account
     */
    password: string;
};

