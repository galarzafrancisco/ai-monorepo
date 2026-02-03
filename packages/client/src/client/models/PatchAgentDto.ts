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
     * Task statuses that will trigger this agent to activate
     */
    statusTriggers?: Array<'NOT_STARTED' | 'IN_PROGRESS' | 'FOR_REVIEW' | 'DONE'>;
    /**
     * Task tags that will trigger this agent to activate
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
        OTHER = 'other',
    }
}

