/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export type AiProviderModelResponseDto = {
    /**
     * Model id as the provider names it
     */
    id: string;
    /**
     * Human-readable name, when the provider gives one
     */
    displayName?: string | null;
    /**
     * What the model is for
     */
    kind: AiProviderModelResponseDto.kind;
};
export namespace AiProviderModelResponseDto {
    /**
     * What the model is for
     */
    export enum kind {
        LANGUAGE = 'language',
        EMBEDDING = 'embedding',
    }
}

