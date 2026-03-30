/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export type ConsentDecisionDto = {
    /**
     * Authorization flow ID (serves as CSRF protection token)
     */
    flow_id: string;
    /**
     * Whether the user approved the authorization request
     */
    approved: boolean;
};

