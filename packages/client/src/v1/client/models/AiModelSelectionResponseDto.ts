/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export type AiModelSelectionResponseDto = {
    /**
     * The job the model is selected for
     */
    job: AiModelSelectionResponseDto.job;
    /**
     * Provider of the job's own selection. Null when nothing is selected for it.
     */
    aiProviderId?: string | null;
    /**
     * Model of the job's own selection. Null when nothing is selected for it.
     */
    modelId?: string | null;
    /**
     * True when the job has no selection of its own and uses the conversation model
     */
    followsConversation: boolean;
    /**
     * Provider the job runs on after applying the fallback
     */
    effectiveAiProviderId?: string | null;
    /**
     * Model the job runs on after applying the fallback
     */
    effectiveModelId?: string | null;
    /**
     * Whether the job can make a call: a model is selected and its provider is configured
     */
    isReady: boolean;
};
export namespace AiModelSelectionResponseDto {
    /**
     * The job the model is selected for
     */
    export enum job {
        CONVERSATION = 'conversation',
        USER_SMALL_TASKS = 'user_small_tasks',
        SYSTEM_SMALL_TASKS = 'system_small_tasks',
        MIDDLE_MANAGER = 'middle_manager',
        EMBEDDINGS = 'embeddings',
    }
}

