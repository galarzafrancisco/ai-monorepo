/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { WorkspaceMemberResponseDto } from './WorkspaceMemberResponseDto.js';
export type InviteWorkspaceMemberResponseDto = {
    member: WorkspaceMemberResponseDto;
    /**
     * Whether an invited account was created for the email. They set a password through account setup before they can sign in.
     */
    accountCreated: boolean;
};

