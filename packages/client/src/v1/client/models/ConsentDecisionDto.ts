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
    /**
     * The workspace the consent screen showed. For Taico's own servers, approval is refused if the session has since switched to another workspace.
     */
    workspace_id?: string;
};

