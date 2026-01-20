/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export type IssueAccessTokenResponseDto = {
    /**
     * Unique identifier for this token (can be used for revocation)
     */
    id: string;
    /**
     * Human-readable name for this token
     */
    name: string;
    /**
     * The raw JWT token - only shown once, store securely!
     */
    token: string;
    /**
     * Scopes granted to this token
     */
    scopes: Array<string>;
    /**
     * When this token expires (ISO 8601)
     */
    expiresAt: string;
    /**
     * When this token was created (ISO 8601)
     */
    createdAt: string;
};

