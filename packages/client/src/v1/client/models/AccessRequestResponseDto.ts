/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { AccessRequestStatus } from './AccessRequestStatus.js';
export type AccessRequestResponseDto = {
    id: string;
    email: string;
    building: string | null;
    status: AccessRequestStatus;
    submissionCount: number;
    createdAt: string;
    lastSubmittedAt: string;
    reviewedAt: string | null;
};

