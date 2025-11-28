/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export type CreateAgentDto = {
    /**
     * Unique, human-readable identifier for the agent
     */
    slug: string;
    /**
     * Display name for the agent
     */
    name: string;
    /**
     * Short description of what this agent does
     */
    description?: string;
    /**
     * Core instructions/persona for this agent
     */
    systemPrompt: string;
    /**
     * List of tool identifiers this agent is allowed to use
     */
    allowedTools: Array<string>;
    /**
     * Whether this agent is available for assignment
     */
    isActive?: boolean;
    /**
     * Max number of tasks this agent can process in parallel
     */
    concurrencyLimit?: number;
};

