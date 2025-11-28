/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { TaskResponseDto } from './TaskResponseDto';
export type SessionResponseDto = {
    /**
     * Unique identifier for the session
     */
    id: string;
    /**
     * ADK session identifier
     */
    adkSessionId: string;
    /**
     * ID of the agent for this chat session
     */
    agentId: string;
    /**
     * Human-readable title for this session
     */
    title: string;
    /**
     * Optional project label for this session
     */
    project?: Record<string, any>;
    /**
     * Whether the session is archived
     */
    isArchived: boolean;
    /**
     * Whether the session is pinned
     */
    isPinned: boolean;
    /**
     * Timestamp of the last message in this chat
     */
    lastMessageAt: string;
    /**
     * Tasks referenced in this session
     */
    referencedTasks?: Array<TaskResponseDto>;
    /**
     * Tasks subscribed to in this session
     */
    subscribedTasks?: Array<TaskResponseDto>;
    /**
     * Row version for optimistic locking
     */
    rowVersion: number;
    /**
     * Session creation timestamp
     */
    createdAt: string;
    /**
     * Session last update timestamp
     */
    updatedAt: string;
    /**
     * Session deletion timestamp (soft delete)
     */
    deletedAt?: Record<string, any>;
};

