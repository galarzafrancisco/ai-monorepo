/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export type ChangeStatusDto = {
    /**
     * New status for the task
     */
    status: ChangeStatusDto.status;
    /**
     * Comment required when marking task as done
     */
    comment?: string;
};
export namespace ChangeStatusDto {
    /**
     * New status for the task
     */
    export enum status {
        NOT_STARTED = 'NOT_STARTED',
        IN_PROGRESS = 'IN_PROGRESS',
        FOR_REVIEW = 'FOR_REVIEW',
        DONE = 'DONE',
    }
}

