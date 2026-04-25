/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export type WorkerResponseDto = {
    id: string;
    oauthClientId: string;
    workerVersion: string | null;
    lastSeenAt: string;
    harnesses: Array<'claude' | 'codex' | 'opencode' | 'adk' | 'githubcopilot' | 'other'>;
    createdAt: string;
    updatedAt: string;
};

