/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { ActorResponseDto } from './ActorResponseDto';
import type { ContextBlockSummaryResponseDto } from './ContextBlockSummaryResponseDto';
import type { MetaTagResponseDto } from './MetaTagResponseDto';
import type { TaskSummaryResponseDto } from './TaskSummaryResponseDto';
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

