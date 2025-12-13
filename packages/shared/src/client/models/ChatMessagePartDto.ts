/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { FunctionCallDto } from './FunctionCallDto';
import type { FunctionResponseDto } from './FunctionResponseDto';
export type ChatMessagePartDto = {
    /**
     * Text content of the message part
     */
    text?: string;
    /**
     * Function call data if this part is a function call
     */
    functionCall?: FunctionCallDto;
    /**
     * Function response data if this part is a function response
     */
    functionResponse?: FunctionResponseDto;
};

