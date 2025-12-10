/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { ChatMessageContentDto } from './ChatMessageContentDto';
import type { UsageMetadataDto } from './UsageMetadataDto';
export type ChatMessageEventDto = {
    id: string;
    timestamp: number;
    author: string;
    content: ChatMessageContentDto;
    partial?: boolean;
    invocationId?: string;
    usageMetadata?: UsageMetadataDto;
};

