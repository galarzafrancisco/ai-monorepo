/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export type BlockTreeResponseDto = {
    /**
     * Unique identifier for the block
     */
    id: string;
    /**
     * Title of the context block
     */
    title: string;
    /**
     * Actor ID of the block creator
     */
    createdByActorId: string;
    /**
     * Creator slug from the associated actor
     */
    createdBy: string | null;
    /**
     * Parent block ID (null if root block)
     */
    parentId: Record<string, any> | null;
    /**
     * Order within siblings
     */
    order: number;
    /**
     * Child blocks
     */
    children: Array<BlockTreeResponseDto>;
    /**
     * Creation timestamp
     */
    createdAt: string;
    /**
     * Last update timestamp
     */
    updatedAt: string;
};

