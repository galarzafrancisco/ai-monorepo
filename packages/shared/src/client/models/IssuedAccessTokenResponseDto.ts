/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export type IssuedAccessTokenResponseDto = {
    /**
     * Unique identifier for this token
     */
    id: string;
    /**
     * Human-readable name for this token
     */
    name: string;
    /**
     * Scopes granted to this token
     */
    scopes: Array<string>;
    /**
     * Subject actor ID this token is issued for (JWT sub claim)
     */
    sub: string;
    /**
     * Subject actor slug
     */
    subjectSlug: string;
    /**
     * Subject actor display name
     */
    subjectDisplayName: string;
    /**
     * Actor ID of the issuer (human who created this token)
     */
    issuedBy: string;
    /**
     * Display name of the issuer
     */
    issuedByDisplayName: string;
    /**
     * When this token expires (ISO 8601)
     */
    expiresAt: string;
    /**
     * When this token was created (ISO 8601)
     */
    createdAt: string;
    /**
     * When this token was revoked (ISO 8601), null if active
     */
    revokedAt?: string | null;
    /**
     * When this token was last used (ISO 8601), null if never used
     */
    lastUsedAt?: string | null;
    /**
     * Whether the token is still valid (not expired and not revoked)
     */
    isValid: boolean;
};

