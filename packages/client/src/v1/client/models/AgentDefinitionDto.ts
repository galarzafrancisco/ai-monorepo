/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { AgentToolPermissionDefinitionDto } from './AgentToolPermissionDefinitionDto.js';
export type AgentDefinitionDto = {
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
    type?: AgentDefinitionDto.type;
    /**
     * Short description of what this agent does
     */
    description?: string | null;
    /**
     * Introduction used for semantic matching
     */
    introduction?: string | null;
    /**
     * Managed avatar URL. External URLs are rejected on import.
     */
    avatarUrl?: string | null;
    /**
     * Core instructions for this agent
     */
    systemPrompt: string;
    /**
     * Prompt sent on the same session after the agent finishes its turn
     */
    followUpPrompt?: string | null;
    /**
     * Provider ID used to select a model runtime
     */
    providerId?: string | null;
    /**
     * Model ID used by the agent runtime
     */
    modelId?: string | null;
    /**
     * Task statuses that trigger this agent
     */
    statusTriggers?: Array<'NOT_STARTED' | 'IN_PROGRESS' | 'FOR_REVIEW' | 'DONE'>;
    /**
     * Task tag names that trigger this agent
     */
    tagTriggers?: Array<string>;
    /**
     * Tool identifiers this agent is allowed to use
     */
    allowedTools?: Array<string>;
    /**
     * Whether this agent is available for assignment
     */
    isActive?: boolean;
    /**
     * Max number of tasks this agent can process in parallel
     */
    concurrencyLimit?: number | null;
    /**
     * Stored tool grants, keyed by MCP server providedId. Omitted means leave existing grants unchanged.
     */
    toolPermissions?: Array<AgentToolPermissionDefinitionDto>;
};
export namespace AgentDefinitionDto {
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

