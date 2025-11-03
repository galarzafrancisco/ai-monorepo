/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export type CommentResponseDto = {
    /**
     * Unique identifier for the comment
     */
    id: string;
    /**
     * ID of the task this comment belongs to
     */
    taskId: string;
    /**
     * Name of the person/agent who created the comment
     */
    commenterName: string;
    /**
     * Content of the comment
     */
    content: string;
    /**
     * Comment creation timestamp
     */
    createdAt: string;
};

