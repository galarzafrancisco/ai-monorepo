/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { AccessRequestHeardFrom } from './AccessRequestHeardFrom.js';
export type CreateAccessRequestDto = {
    email: string;
    /**
     * What are you building with agents?
     */
    building?: string;
    /**
     * Where did you hear about Taico?
     */
    heardFrom?: AccessRequestHeardFrom;
    /**
     * Where, when heardFrom is "other". Ignored for any other heardFrom.
     */
    heardFromOther?: string;
    /**
     * Leave empty.
     */
    website?: string;
};

