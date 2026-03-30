/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export type ProjectResponseDto = {
    /**
     * Project unique identifier
     */
    id: string;
    /**
     * Tag ID associated with this project
     */
    tagId: string;
    /**
     * Tag name (project:slug format)
     */
    tagName: string;
    /**
     * Tag color in hex format
     */
    tagColor: string;
    /**
     * Project slug
     */
    slug: string;
    /**
     * Project description
     */
    description?: string;
    /**
     * Repository URL
     */
    repoUrl?: string;
    /**
     * Creation timestamp
     */
    createdAt: string;
    /**
     * Last update timestamp
     */
    updatedAt: string;
};

