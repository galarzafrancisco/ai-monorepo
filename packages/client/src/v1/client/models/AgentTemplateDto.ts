/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export type AgentTemplateDto = {
    /**
     * Stable template identifier.
     */
    id: string;
    /**
     * Human-readable template name.
     */
    label: string;
    /**
     * Short explanation of what this template configures.
     */
    description: string;
    /**
     * Default harness type for this template.
     */
    type?: AgentTemplateDto.type;
    /**
     * Default provider ID for this template.
     */
    providerId?: string;
    /**
     * Default model ID for this template.
     */
    modelId?: string;
    /**
     * Default system prompt for this template.
     */
    systemPrompt: string;
    /**
     * Default agent description.
     */
    agentDescription?: string;
    /**
     * Default statuses that trigger the agent.
     */
    statusTriggers: Array<'NOT_STARTED' | 'IN_PROGRESS' | 'FOR_REVIEW' | 'DONE'>;
    /**
     * Default tag names that filter agent triggers.
     */
    tagTriggers: Array<string>;
    /**
     * Default avatar URL for this template.
     */
    avatarUrl?: string;
    /**
     * Default concurrency limit for this template.
     */
    concurrencyLimit?: number;
};
export namespace AgentTemplateDto {
    /**
     * Default harness type for this template.
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

