/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export type UserOnboardingStatusResponseDto = {
    workerConfigured: boolean;
    agentCreated: boolean;
    taskCreated: boolean;
    projectCreated: boolean;
    contextBlockCreated: boolean;
    threadConfigured: boolean;
    taskWithProjectCreated: boolean;
    onboardingDisplayMode: UserOnboardingStatusResponseDto.onboardingDisplayMode;
};
export namespace UserOnboardingStatusResponseDto {
    export enum onboardingDisplayMode {
        FULL_PAGE = 'FULL_PAGE',
        BANNER = 'BANNER',
        OFF = 'OFF',
    }
}

