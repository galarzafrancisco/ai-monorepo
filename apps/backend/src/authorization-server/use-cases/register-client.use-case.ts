import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { AuthJourneyStatus } from '../../auth-journeys/enums/auth-journey-status.enum';
import { McpAuthorizationFlowStatus } from '../../auth-journeys/enums/mcp-authorization-flow-status.enum';
import {
  AuthJourneyEntity,
  ConnectionAuthorizationFlowEntity,
  McpAuthorizationFlowEntity,
} from '../../auth-journeys/entities';
import { RegisterClientDto } from '../dto/register-client.dto';
import { RegisteredClientEntity } from '../entities/registered-client.entity';

export type RegisterClientCommand = {
  dto: RegisterClientDto;
  clientId: string;
  clientSecretHash: string | null;
  scopes: string[];
  server: { id: string; connections: Array<{ id: string }> };
};

/** Creates a registered client and its initial authorization journey together. */
@Injectable()
export class RegisterClientUseCase {
  constructor(private readonly dataSource: DataSource) {}

  async execute(
    command: RegisterClientCommand,
  ): Promise<RegisteredClientEntity> {
    return this.dataSource.transaction(async (manager) => {
      const clientRepository = manager.getRepository(RegisteredClientEntity);
      const journeyRepository = manager.getRepository(AuthJourneyEntity);
      const mcpFlowRepository = manager.getRepository(
        McpAuthorizationFlowEntity,
      );
      const connectionFlowRepository = manager.getRepository(
        ConnectionAuthorizationFlowEntity,
      );
      const client = await clientRepository.save(
        clientRepository.create({
          clientId: command.clientId,
          clientSecret: command.clientSecretHash,
          clientName: command.dto.client_name,
          redirectUris: command.dto.redirect_uris,
          grantTypes: command.dto.grant_types,
          tokenEndpointAuthMethod: command.dto.token_endpoint_auth_method,
          scopes: command.scopes,
          contacts: command.dto.contacts || null,
        }),
      );
      const journey = await journeyRepository.save(
        journeyRepository.create({
          status: AuthJourneyStatus.MCP_AUTH_FLOW_STARTED,
        }),
      );
      await mcpFlowRepository.save(
        mcpFlowRepository.create({
          authorizationJourneyId: journey.id,
          serverId: command.server.id,
          clientId: client.id,
          status: McpAuthorizationFlowStatus.CLIENT_REGISTERED,
        }),
      );
      const connectionFlows = command.server.connections.map((connection) =>
        connectionFlowRepository.create({
          authorizationJourneyId: journey.id,
          mcpConnectionId: connection.id,
        }),
      );
      if (connectionFlows.length) {
        await connectionFlowRepository.save(connectionFlows);
      }
      return client;
    });
  }
}
