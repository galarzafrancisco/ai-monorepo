/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export type ScopeResponseDto = {
    /**
     * Unique scope identifier (e.g., tool:read)
     */
    id: string;
    /**
     * Description of what this scope allows
     */
    description: string;
    /**
     * UUID of the MCP server this scope belongs to
     */
    serverId: string;
    /**
     * Timestamp when the scope was created
     */
    createdAt: string;
    /**
     * Timestamp when the scope was last updated
     */
    updatedAt: string;
};

