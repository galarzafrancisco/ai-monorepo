/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export type CreateThreadMessageDto = {
    /**
     * Role of the message sender
     */
    role: CreateThreadMessageDto.role;
    /**
     * Content of the message
     */
    content: string;
    /**
     * Actor ID who created the message (optional for system messages)
     */
    createdByActorId?: string;
};
export namespace CreateThreadMessageDto {
    /**
     * Role of the message sender
     */
    export enum role {
        USER = 'user',
        ASSISTANT = 'assistant',
        SYSTEM = 'system',
    }
}

