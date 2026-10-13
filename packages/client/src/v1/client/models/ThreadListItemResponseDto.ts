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
     * State context block ID that tracks the evolving state of this thread
     */
    stateContextBlockId: string;
    /**
     * Messages in this thread written by someone else that the caller has not read yet
     */
    unreadCount: number;
};

