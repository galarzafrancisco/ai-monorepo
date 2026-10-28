/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export type GithubWebhookSourceDto = {
    owner: string;
    /**
     * The repository, or null when the webhook covers every repository of the owner (organization or GitHub App webhook)
     */
    repo: string | null;
    lastDeliveryAt: string;
    /**
     * Event of the last delivery; ping right after the webhook is set up
     */
    lastEvent: string | null;
    /**
     * Delivered in the last day: Taico counts on the webhook and polls this repository less
     */
    active: boolean;
};

