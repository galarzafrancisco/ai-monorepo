/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { AgentTemplateModelOptionDto } from './AgentTemplateModelOptionDto.js';
export type AgentTemplateHarnessDto = {
    /**
     * Agent harness type.
     */
    type: AgentTemplateHarnessDto.type;
    /**
     * Human-readable harness name.
     */
    label: string;
    /**
     * Short explanation of when to use this harness.
     */
    description: string;
    modelOptions: Array<AgentTemplateModelOptionDto>;
};
export namespace AgentTemplateHarnessDto {
    /**
     * Agent harness type.
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

