/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { ActorResponseDto } from './ActorResponseDto';
import type { TaskInfoDto } from './TaskInfoDto';
export type AgentRunResponseDto = {
    /**
     * Unique identifier for the agent run
     */
    id: string;
    /**
     * UUID of the actor (agent) running
     */
    actorId: string;
    /**
     * Actor information
     */
    actor?: ActorResponseDto | null;
    /**
     * UUID of the parent task being executed
     */
    parentTaskId: string;
    /**
     * Parent task information
     */
    parentTask?: TaskInfoDto | null;
    /**
     * Run creation timestamp
     */
    createdAt: string;
    /**
     * Timestamp when the run started
     */
    startedAt?: Record<string, any> | null;
    /**
     * Timestamp when the run ended
     */
    endedAt?: Record<string, any> | null;
    /**
     * Timestamp of the last ping/heartbeat
     */
    lastPing?: Record<string, any> | null;
};

