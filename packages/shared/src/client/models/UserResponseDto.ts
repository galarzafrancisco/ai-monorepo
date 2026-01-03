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
};
export namespace UserResponseDto {
    /**
     * User role
     */
    export enum role {
        ADMIN = 'admin',
        STANDARD = 'standard',
    }
}

