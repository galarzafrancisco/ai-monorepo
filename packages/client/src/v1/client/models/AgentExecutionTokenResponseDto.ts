/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export type AgentExecutionTokenResponseDto = {
    /**
     * The raw short-lived JWT execution token for the agent.
     */
    token: string;
    /**
     * Scopes granted to this token.
     */
    scopes: Array<string>;
    /**
     * When this token expires (ISO 8601).
     */
    expiresAt: string;
    /**
     * Agent slug this token acts as.
     */
    agentSlug: string;
    /**
     * Client identifier of the caller that requested the token.
     */
    requestedByClientId: string;
};

