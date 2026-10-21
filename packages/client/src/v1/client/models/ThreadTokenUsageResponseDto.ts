/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export type ThreadTokenUsageResponseDto = {
    /**
     * Input tokens of the most recent model step: roughly the size of the conversation the model reads now. Null when the provider reported no figure.
     */
    contextTokens: number | null;
    /**
     * Input tokens summed over every model step in the thread. Null when no step reported a figure.
     */
    inputTokens: number | null;
    /**
     * Output tokens summed over every model step in the thread. Null when no step reported a figure.
     */
    outputTokens: number | null;
    /**
     * Number of model steps that reported token usage
     */
    steps: number;
};

