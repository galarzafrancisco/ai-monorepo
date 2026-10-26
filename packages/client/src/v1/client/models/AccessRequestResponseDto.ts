/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export type AccessRequestResponseDto = {
    id: string;
    email: string;
    building: string | null;
    status: AccessRequestResponseDto.status;
    submissionCount: number;
    createdAt: string;
    lastSubmittedAt: string;
    reviewedAt: string | null;
};
export namespace AccessRequestResponseDto {
    export enum status {
        NEW = 'new',
        REVIEWED = 'reviewed',
    }
}

