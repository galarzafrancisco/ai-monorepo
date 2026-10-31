/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export type PatchProjectDto = {
    /**
     * Tag IDs automatically applied to tasks assigned to this project
     */
    autoTagIds?: Array<string>;
    /**
     * Project description
     */
    description?: string;
    /**
     * Repository URL for code projects (supports HTTP/HTTPS and SSH URLs)
     */
    repoUrl?: string;
    /**
     * GitHub connection for this project. Null picks one automatically from the repository owner.
     */
    githubConnectionId?: string | null;
    /**
     * Whether workers get a token from the project's GitHub connection to clone and push
     */
    githubForWorker?: boolean;
};

