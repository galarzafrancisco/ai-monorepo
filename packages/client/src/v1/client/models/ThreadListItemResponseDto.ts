/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export type ThreadListItemResponseDto = {
    /**
     * Thread ID
     */
    id: string;
    /**
     * Thread title
     */
    title: string;
    /**
     * Provider-specific chat session/conversation ID associated with this thread
     */
    chatSessionId: string | null;
    /**
     * State context block ID that tracks the evolving state of this thread
     */
    stateContextBlockId: string;
};

