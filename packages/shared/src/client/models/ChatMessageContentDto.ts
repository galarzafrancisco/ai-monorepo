/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { ChatMessagePartDto } from './ChatMessagePartDto';
export type ChatMessageContentDto = {
    /**
     * Role of the message author (user, agent, system)
     */
    role: string;
    /**
     * Parts of the message content
     */
    parts: Array<ChatMessagePartDto>;
};

