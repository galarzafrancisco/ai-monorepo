/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export type ManagedUserResponseDto = {
    /**
     * User ID
     */
    id: string;
    /**
     * User email address
     */
    email: string;
    /**
     * Display name from the associated human actor
     */
    displayName: string;
    /**
     * Actor slug/username
     */
    slug: string;
    /**
     * Actor ID associated with this user
     */
    actorId: string;
    /**
     * User role
     */
    role: ManagedUserResponseDto.role;
    /**
     * Whether this user can currently sign in
     */
    isActive: boolean;
    /**
     * Whether this user still needs to set a password
     */
    passwordSetupPending: boolean;
    /**
     * Creation timestamp
     */
    createdAt: string;
    /**
     * Last update timestamp
     */
    updatedAt: string;
};
export namespace ManagedUserResponseDto {
    /**
     * User role
     */
    export enum role {
        ADMIN = 'admin',
        STANDARD = 'standard',
    }
}

