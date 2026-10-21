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
     * When the latest message people can see was posted, or when the thread was created if it has none. The list is ordered by this, newest first
     */
    lastActivityAt: string;
    /**
     * Messages in this thread written by someone else that the caller has not read yet
     */
    unreadCount: number;
    /**
     * The caller pinned this thread. Pinned threads are listed before all others
     */
    pinned: boolean;
};

