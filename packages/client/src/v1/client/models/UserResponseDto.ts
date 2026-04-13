/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export type UserResponseDto = {
    /**
     * User ID
     */
    id: string;
    /**
     * User email address
     */
    email: string;
    /**
     * User display name
     */
    displayName: string;
    /**
     * User role
     */
    role: UserResponseDto.role;
    /**
     * Actor ID associated with this user
     */
    actorId: string;
    /**
     * How onboarding UI should be shown for this user (full page, banner, or off)
     */
    onboardingDisplayMode: UserResponseDto.onboardingDisplayMode;
};
export namespace UserResponseDto {
    /**
     * User role
     */
    export enum role {
        ADMIN = 'admin',
        STANDARD = 'standard',
    }
    /**
     * How onboarding UI should be shown for this user (full page, banner, or off)
     */
    export enum onboardingDisplayMode {
        FULL_PAGE = 'FULL_PAGE',
        BANNER = 'BANNER',
        OFF = 'OFF',
    }
}

