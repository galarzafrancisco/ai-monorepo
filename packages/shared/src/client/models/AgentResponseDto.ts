/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export type AgentResponseDto = {
    /**
     * Unique identifier for the agent
     */
    id: string;
    /**
     * Unique, human-readable identifier
     */
    slug: string;
    /**
     * Display name for the agent
     */
    name: string;
    /**
     * Short description of what this agent does
     */
    description?: Record<string, any>;
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
    isActive: boolean;
    /**
     * Max number of tasks this agent can process in parallel
     */
    concurrencyLimit?: Record<string, any>;
    /**
     * Row version for optimistic locking
     */
    rowVersion: number;
    /**
     * Agent creation timestamp
     */
    createdAt: string;
    /**
     * Agent last update timestamp
     */
    updatedAt: string;
    /**
     * Agent deletion timestamp (soft delete)
     */
    deletedAt?: Record<string, any>;
};

