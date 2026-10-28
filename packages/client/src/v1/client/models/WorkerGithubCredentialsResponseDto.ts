/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { WorkerGithubCredentialDto } from './WorkerGithubCredentialDto.js';
export type WorkerGithubCredentialsResponseDto = {
    /**
     * One per project of the task whose GitHub connection may be used by workers. Empty when none is: the worker then uses the machine's own credentials.
     */
    credentials: Array<WorkerGithubCredentialDto>;
};

