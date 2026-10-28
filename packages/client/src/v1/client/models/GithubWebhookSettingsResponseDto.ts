/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export type GithubWebhookSettingsResponseDto = {
    /**
     * Payload URL to enter in GitHub (repository, organization or app webhook settings)
     */
    url: string;
    /**
     * Secret to enter in GitHub. GitHub signs every delivery with it.
     */
    secret: string;
    /**
     * When the last correctly signed delivery arrived
     */
    lastDeliveryAt: string | null;
};

