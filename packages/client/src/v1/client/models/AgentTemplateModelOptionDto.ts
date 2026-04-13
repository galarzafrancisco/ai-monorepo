/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export type AgentTemplateModelOptionDto = {
    /**
     * Stable option identifier used by the UI.
     */
    id: string;
    /**
     * Human-readable model option label.
     */
    label: string;
    /**
     * Provider ID submitted when this option is selected.
     */
    providerId?: string;
    /**
     * Model ID submitted when this option is selected.
     */
    modelId?: string;
    /**
     * Whether this represents the runtime default model.
     */
    isDefault: boolean;
};

