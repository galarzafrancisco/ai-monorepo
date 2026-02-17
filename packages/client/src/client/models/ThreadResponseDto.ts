/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { ActorResponseDto } from './ActorResponseDto.js';
import type { ContextBlockSummaryResponseDto } from './ContextBlockSummaryResponseDto.js';
import type { MetaTagResponseDto } from './MetaTagResponseDto.js';
import type { TaskSummaryResponseDto } from './TaskSummaryResponseDto.js';
export type ThreadResponseDto = {
    /**
     * Thread ID
     */
    id: string;
    /**
     * Thread title
     */
    title: string;
    /**
     * Actor who created the thread
     */
    createdByActor: ActorResponseDto;
    /**
     * Parent task ID that this thread belongs to (null for headless threads)
     */
    parentTaskId?: string | null;
    /**
     * State context block ID that tracks the evolving state of this thread
     */
    stateContextBlockId: string;
    /**
     * Tasks attached to this thread
     */
    tasks: Array<TaskSummaryResponseDto>;
    /**
     * Context blocks referenced in this thread
     */
    referencedContextBlocks: Array<ContextBlockSummaryResponseDto>;
    /**
     * Tags associated with this thread
     */
    tags: Array<MetaTagResponseDto>;
    /**
     * Participants in this thread
     */
    participants: Array<ActorResponseDto>;
    /**
     * Row version for optimistic locking
     */
    rowVersion: number;
    /**
     * When the thread was created
     */
    createdAt: string;
    /**
     * When the thread was last updated
     */
    updatedAt: string;
};

