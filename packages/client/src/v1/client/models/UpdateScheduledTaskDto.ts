/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export type UpdateScheduledTaskDto = {
    /**
     * Cron expression for scheduling (e.g., "0 9 * * 1-5" for weekdays at 9am)
     */
    cronExpression?: string;
    /**
     * Whether the scheduled task is enabled
     */
    enabled?: boolean;
};

