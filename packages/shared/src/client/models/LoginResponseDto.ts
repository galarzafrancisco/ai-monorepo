/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { UserResponseDto } from './UserResponseDto';
export type LoginResponseDto = {
    /**
     * Authenticated user information
     */
    user: UserResponseDto;
    /**
     * Access token expiration time in seconds
     */
    expiresIn: number;
};

