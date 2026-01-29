import { McpAuthorizationFlowStatus } from 'src/auth-journeys/enums/mcp-authorization-flow-status.enum';

/*
Metadata to show on the consent screen
*/
export type ConsentMetadata = {
  id: string;
  status: McpAuthorizationFlowStatus;
  scopes?: string[];
  resource?: string;
  server: {
    providedId: string;
    name: string;
    description: string;
  };
  client: {
    clientId: string;
    clientName: string;
  };
  redirectUri: string;
  createdAt: Date;
};
