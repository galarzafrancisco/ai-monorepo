/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export type IssueAccessTokenRequestDto = {
    /**
     * Human-readable name for this token (e.g., "CI/CD Pipeline Token")
     */
    name: string;
    /**
     * Scopes to grant to this token
     */
    scopes: Array<string>;
    /**
     * Number of days until token expires (default: 30, max: 365)
     */
    expirationDays?: number;
};

