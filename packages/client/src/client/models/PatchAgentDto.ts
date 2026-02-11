/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export type PatchAgentDto = {
    /**
     * Core instructions/persona for this agent
     */
    systemPrompt?: string;
    /**
     * Provider ID to select a model runtime
     */
    providerId?: string;
    /**
     * Model ID used by the agent runtime
     */
    modelId?: string;
    /**
     * Task statuses that trigger agent activation. When a task transitions to one of these statuses AND matches any tagTriggers (if specified), the agent will be notified to process it. Common patterns: [NOT_STARTED] for new task pickup, [FOR_REVIEW] for review workflows, [IN_PROGRESS] for monitoring active work.
     */
    statusTriggers?: Array<'NOT_STARTED' | 'IN_PROGRESS' | 'FOR_REVIEW' | 'DONE'>;
    /**
     * Task tags that trigger agent activation (combined with statusTriggers using AND logic). When both a matching status AND tag are present, the agent activates. If empty, only status matching is required. Common examples: ["code"] for code-related tasks, ["review"] for review workflows, ["urgent"] for priority handling.
     */
    tagTriggers?: Array<string>;
    /**
     * Type of agent (provider)
     */
    type?: PatchAgentDto.type;
    /**
     * Introduction field for semantic matching - describes what this agent is good at and when to assign them tasks
     */
    introduction?: string;
    /**
     * Optional avatar URL for the agent actor
     */
    avatarUrl?: string | null;
};
export namespace PatchAgentDto {
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

