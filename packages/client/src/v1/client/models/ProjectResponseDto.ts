/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export type ProjectResponseDto = {
    /**
     * Tag IDs automatically applied to tasks assigned to this project
     */
    autoTagIds: Array<string>;
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
     * GitHub connection for this project. Null picks one automatically from the repository owner.
     */
    githubConnectionId: string | null;
    /**
     * Whether workers get a token from the project's GitHub connection to clone and push
     */
    githubForWorker: boolean;
    /**
     * Creation timestamp
     */
    createdAt: string;
    /**
     * Last update timestamp
     */
    updatedAt: string;
};

