/*
Details the latest state of the journey
*/
export enum McpAuthorizationFlowStatus {

  // Client Registration
  CLIENT_NOT_REGISTERED = 'CLIENT_NOT_REGISTERED', // Start here
  CLIENT_REGISTERED = 'CLIENT_REGISTERED', // Client ID generated, stored in db. Response sent to client.

  // Authorization flow
  AUTHORIZATION_REQUEST_STARTED = 'AUTHORIZATION_REQUEST_STARTED', // Client hits the AS auth endpoint with GET
  USER_CONSENT_OK = 'USER_CONSENT_OK', // User gave the ok in the consent flow
  USER_CONSENT_REJECTED = 'USER_CONSENT_REJECTED', // User rejected during the consent flow
  WAITING_ON_DOWNSTREAM_AUTH = 'WAITING_ON_DOWNSTREAM_AUTH', // If the MCP Server has connections that need to authenticate and we are waiting on them
  AUTHORIZATION_CODE_ISSUED = 'AUTHORIZATION_CODE_ISSUED', // We sent 

  // Token exchange
  AUTHORIZATION_CODE_EXCHANGED = 'AUTHORIZATION_CODE_EXCHANGED',
}
