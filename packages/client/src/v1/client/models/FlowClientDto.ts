/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export type FlowClientDto = {
    /**
     * OAuth client identifier
     */
    clientId: string;
    /**
     * Human-readable name of the client application
     */
    clientName: string;
    /**
     * How the client is known: it registered, or its client_id is a URL to a metadata document it hosts. The client name is self-declared either way.
     */
    registrationMethod: FlowClientDto.registrationMethod;
};
export namespace FlowClientDto {
    /**
     * How the client is known: it registered, or its client_id is a URL to a metadata document it hosts. The client name is self-declared either way.
     */
    export enum registrationMethod {
        DYNAMIC_REGISTRATION = 'dynamic_registration',
        METADATA_DOCUMENT = 'metadata_document',
    }
}

