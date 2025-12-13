/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { ChatMessageContentDto } from './ChatMessageContentDto';
import type { UsageMetadataDto } from './UsageMetadataDto';
export type ChatEventDto = {
    /**
     * Unique identifier for the chat event
     */
    id: string;
    /**
     * Unix timestamp when the event occurred
     */
    timestamp: number;
    /**
     * Author of the event (user ID or agent ID)
     */
    author: string;
    /**
     * Content of the chat message
     */
    content: ChatMessageContentDto;
    /**
     * Whether this is a partial event (streaming)
     */
    partial?: boolean;
    /**
     * Invocation identifier for the chat turn
     */
    invocationId?: string;
    /**
     * Token usage metadata for the event
     */
    usageMetadata?: UsageMetadataDto;
};

