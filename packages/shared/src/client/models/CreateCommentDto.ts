/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export type CreateCommentDto = {
    /**
     * Name of the person or agent commenting (auto-populated from authenticated user if not provided)
     */
    commenterName?: string;
    /**
     * Content of the comment
     */
    content: string;
};

