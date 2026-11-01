/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { AgentDefinitionDto } from './AgentDefinitionDto.js';
export type AgentDefinitionsDocumentDto = {
    /**
     * Portable agent definition document version
     */
    version: number;
    /**
     * Agent definitions to export or import
     */
    agents: Array<AgentDefinitionDto>;
};

