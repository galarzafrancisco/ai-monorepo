/*
Details the latest state of the journey
*/
export enum AuthJourneyStatus {
  NOT_STARTED = 'not_started',
  MCP_AUTH_FLOW_STARTED = 'mcp_auth_flow_started',
  MCP_AUTH_FLOW_COMPLETED = 'mcp_auth_flow_completed',
  CONNECTIONS_FLOW_STARTED = 'connections_flow_started',
  CONNECTIONS_FLOW_COMPLETED = 'connections_flow_completed',
  AUTHORIZATION_CODE_ISSUED = 'authorization_code_issued',
  AUTHORIZATION_CODE_EXCHANGED = 'authorization_code_exchanged',
}
