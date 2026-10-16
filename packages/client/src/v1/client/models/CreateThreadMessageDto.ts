/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export type CreateThreadMessageDto = {
    /**
     * Content of the message
     */
    content: string;
    /**
     * IANA timezone of the person writing, as their client reports it. Lets the threads agent read relative times such as "tomorrow at 5pm". Raw offsets are rejected.
     */
    timezone?: string;
};

