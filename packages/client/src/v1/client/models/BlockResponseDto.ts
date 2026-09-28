/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { ContextTagResponseDto } from './ContextTagResponseDto.js';
export type BlockResponseDto = {
    /**
     * Unique identifier for the block
     */
    id: string;
    /**
     * Title of the context block
     */
    title: string;
    /**
     * Markdown content of the context block
     */
    content: string;
    /**
     * Actor ID of the block creator
     */
    createdByActorId: string;
    /**
     * Creator slug from the associated actor
     */
    createdBy: string | null;
    /**
     * Whether the creator has been deactivated
     */
    createdByIsDeactivated: boolean;
    /**
     * Actor ID of the block assignee
     */
    assigneeActorId: Record<string, any> | null;
    /**
     * Assignee slug from the associated actor
     */
    assignee: string | null;
    /**
     * Whether the assignee has been deactivated
     */
    assigneeIsDeactivated: boolean;
    /**
     * Tags associated with the block
     */
    tags: Array<ContextTagResponseDto>;
    /**
     * Parent block ID (null if root block)
     */
    parentId: Record<string, any> | null;
    /**
     * Order within siblings
     */
    order: number;
    /**
     * Creation timestamp
     */
    createdAt: string;
    /**
     * Last update timestamp
     */
    updatedAt: string;
};

