/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { ActorResponseDto } from './ActorResponseDto.js';
export type ThreadMessageResponseDto = {
    /**
     * Message ID
     */
    id: string;
    /**
     * Thread ID this message belongs to
     */
    threadId: string;
    /**
     * Content of the message
     */
    content: string;
    /**
     * Actor who created the message
     */
    createdByActor?: ActorResponseDto | null;
    /**
     * When the message was created
     */
    createdAt: string;
};

