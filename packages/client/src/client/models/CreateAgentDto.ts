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
     * Type of agent (provider)
     */
    type?: CreateAgentDto.type;
    /**
     * Short description of what this agent does
     */
    description?: string;
    /**
     * Introduction field for semantic matching - describes what this agent is good at and when to assign them tasks
     */
    introduction?: string;
    /**
     * Optional avatar URL for the agent actor
     */
    avatarUrl?: string | null;
    /**
     * Core instructions/persona for this agent
     */
    systemPrompt: string;
    /**
     * Provider ID to select a model runtime
     */
    providerId?: string;
    /**
     * Model ID used by the agent runtime
     */
    modelId?: string;
    /**
     * Task statuses that will trigger this agent to activate
     */
    statusTriggers?: Array<'NOT_STARTED' | 'IN_PROGRESS' | 'FOR_REVIEW' | 'DONE'>;
    /**
     * Task tags that will trigger this agent to activate
     */
    tagTriggers?: Array<string>;
    /**
     * List of tool identifiers this agent is allowed to use
     */
    allowedTools?: Array<string>;
    /**
     * Whether this agent is available for assignment
     */
    isActive?: boolean;
    /**
     * Max number of tasks this agent can process in parallel
     */
    concurrencyLimit?: number;
};
export namespace CreateAgentDto {
    /**
     * Type of agent (provider)
     */
    export enum type {
        CLAUDE = 'claude',
        CODEX = 'codex',
        OPENCODE = 'opencode',
        ADK = 'adk',
        OTHER = 'other',
    }
}

