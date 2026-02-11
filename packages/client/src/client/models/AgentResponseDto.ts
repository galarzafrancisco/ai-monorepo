/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export type AgentResponseDto = {
    /**
     * Unique identifier for the actor representing this agent
     */
    actorId: string;
    /**
     * Unique, human-readable identifier
     */
    slug: string;
    /**
     * Display name for the agent
     */
    name: string;
    /**
     * Type of agent (provider)
     */
    type: AgentResponseDto.type;
    /**
     * Short description of what this agent does
     */
    description?: Record<string, any>;
    /**
     * Introduction field for semantic matching - describes what this agent is good at and when to assign them tasks
     */
    introduction?: Record<string, any>;
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
    providerId?: string | null;
    /**
     * Model ID used by the agent runtime
     */
    modelId?: string | null;
    /**
     * Task statuses that trigger this agent to activate
     */
    statusTriggers: Array<'NOT_STARTED' | 'IN_PROGRESS' | 'FOR_REVIEW' | 'DONE'>;
    /**
     * Task tags that trigger this agent to activate
     */
    tagTriggers: Array<string>;
    /**
     * List of MCP tool identifiers this agent is allowed to use
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
export namespace AgentResponseDto {
    /**
     * Type of agent (provider)
     */
    export enum type {
        CLAUDE = 'claude',
        CODEX = 'codex',
        OPENCODE = 'opencode',
        ADK = 'adk',
        GITHUBCOPILOT = 'githubcopilot',
        OTHER = 'other',
    }
}

