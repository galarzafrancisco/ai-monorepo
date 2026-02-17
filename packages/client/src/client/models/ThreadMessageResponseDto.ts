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
     * Role of the message sender
     */
    role: ThreadMessageResponseDto.role;
    /**
     * Content of the message
     */
    content: string;
    /**
     * Actor who created the message (null for system messages)
     */
    createdByActor?: ActorResponseDto | null;
    /**
     * When the message was created
     */
    createdAt: string;
};
export namespace ThreadMessageResponseDto {
    /**
     * Role of the message sender
     */
    export enum role {
        USER = 'user',
        ASSISTANT = 'assistant',
        SYSTEM = 'system',
    }
}

