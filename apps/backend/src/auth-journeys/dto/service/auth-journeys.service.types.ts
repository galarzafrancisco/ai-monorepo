import { ActorType } from '../../../identity-provider/enums';
import { AuthJourneyStatus } from '../../enums/auth-journey-status.enum';
import { ConnectionAuthorizationFlowStatus } from '../../enums/connection-authorization-flow-status.enum';
import { McpAuthorizationFlowStatus } from '../../enums/mcp-authorization-flow-status.enum';

/*
Starts during client registration.
 - "I am this client, I want to connect to that server."
*/
export type CreateAuthJourneyInput = {
  mcpClientId: string;
  mcpServerId: string;
};

export type AuthJourneyActorResult = {
  id: string;
  type: ActorType;
  slug: string;
  displayName: string;
  avatarUrl: string | null;
  introduction: string | null;
};

export type McpAuthorizationFlowResult = {
  id: string;
  authorizationJourneyId: string;
  serverId: string;
  clientId: string;
  clientName: string | null;
  status: McpAuthorizationFlowStatus;
  scope: string | null;
  authorizationCodeExpiresAt: Date | null;
  authorizationCodeUsed: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export type ConnectionAuthorizationFlowResult = {
  id: string;
  authorizationJourneyId: string;
  mcpConnectionId: string;
  connectionName: string | null;
  status: ConnectionAuthorizationFlowStatus;
  tokenExpiresAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export type AuthJourneyResult = {
  id: string;
  status: AuthJourneyStatus;
  actor: AuthJourneyActorResult | null;
  mcpAuthorizationFlow: McpAuthorizationFlowResult;
  connectionAuthorizationFlows: ConnectionAuthorizationFlowResult[];
  createdAt: Date;
  updatedAt: Date;
};
