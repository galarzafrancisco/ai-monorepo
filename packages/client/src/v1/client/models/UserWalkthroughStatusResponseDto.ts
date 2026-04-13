/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export type UserWalkthroughStatusResponseDto = {
    workerConfigured: boolean;
    agentCreated: boolean;
    taskCreated: boolean;
    projectCreated: boolean;
    projectConfigured: boolean;
    contextBlockCreated: boolean;
    threadConfigured: boolean;
    taskWithProjectCreated: boolean;
    onboardingDisplayMode: UserWalkthroughStatusResponseDto.onboardingDisplayMode;
};
export namespace UserWalkthroughStatusResponseDto {
    export enum onboardingDisplayMode {
        FULL_PAGE = 'FULL_PAGE',
        BANNER = 'BANNER',
        OFF = 'OFF',
    }
}

