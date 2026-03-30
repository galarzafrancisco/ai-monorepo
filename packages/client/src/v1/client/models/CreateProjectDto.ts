/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export type CreateProjectDto = {
    /**
     * Project slug (e.g., "taico")
     */
    slug: string;
    /**
     * Project description
     */
    description?: string;
    /**
     * Repository URL for code projects (supports HTTP/HTTPS and SSH URLs)
     */
    repoUrl?: string;
    /**
     * Tag color in hex format
     */
    color?: string;
};

