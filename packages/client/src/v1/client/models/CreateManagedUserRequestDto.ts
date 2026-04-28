/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export type CreateManagedUserRequestDto = {
    /**
     * Email address to invite
     */
    email: string;
    /**
     * Role for the new user
     */
    role: CreateManagedUserRequestDto.role;
};
export namespace CreateManagedUserRequestDto {
    /**
     * Role for the new user
     */
    export enum role {
        ADMIN = 'admin',
        STANDARD = 'standard',
    }
}

