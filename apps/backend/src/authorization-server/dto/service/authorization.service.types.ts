import { ClientRegistrationMethod } from '../../enums';
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
    registrationMethod: ClientRegistrationMethod;
  };
  /** The workspace the token will work in. */
  workspace: {
    id: string;
    slug: string;
    name: string;
  };
  /**
   * The slug of the workspace the client asked for (a worker started with
   * `--workspace`); null if it did not ask. Approval is refused unless the
   * person is in that workspace.
   */
  requestedWorkspaceSlug: string | null;
  redirectUri: string;
  createdAt: Date;
};
