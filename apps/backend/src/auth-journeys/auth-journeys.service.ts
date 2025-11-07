import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  AuthJourneyEntity,
  ConnectionAuthorizationFlowEntity,
  McpAuthorizationFlowEntity,
} from './entities';
import { AuthJourneyStatus } from './enums/auth-journey-status.enum';
import { CreateAuthJourneyInput } from './dto/service/auth-journeys.service.types';
import { McpRegistryService } from 'src/mcp-registry/mcp-registry.service';

@Injectable()
export class AuthJourneysService {
  constructor(
    @InjectRepository(AuthJourneyEntity)
    private readonly authJourneyRepository: Repository<AuthJourneyEntity>,
    @InjectRepository(McpAuthorizationFlowEntity)
    private readonly mcpAuthorizationFlowRepository: Repository<McpAuthorizationFlowEntity>,
    @InjectRepository(ConnectionAuthorizationFlowEntity)
    private readonly connectionAuthorizationFlowRepository: Repository<ConnectionAuthorizationFlowEntity>,

    private readonly mcpRegistryService: McpRegistryService
  ) { }

  /*
  Internal. Assumes mcp server and mcp client exist.
  The caller does validate it. To avoid duplicating logic, we skip validation here.
  Database should complain if something is wrong which will bubble up as a 500.
  */
  async createJourneyForMcpRegistration(
    input: CreateAuthJourneyInput,
  ): Promise<{
    authorizationJourney: AuthJourneyEntity;
    mcpAuthorizationFlow: McpAuthorizationFlowEntity;
    connectionAuthorizationFlows: ConnectionAuthorizationFlowEntity[];
  }> {

    // Get the MCP Server
    const mcpServer = await this.mcpRegistryService.getServerById(input.mcpServerId);

    // Start an Auth journey
    const journey = this.authJourneyRepository.create({
      status: AuthJourneyStatus.MCP_AUTH_FLOW_STARTED,
    });
    const savedJourney = await this.authJourneyRepository.save(journey);

    // Start an MCP Authorization Flow
    const mcpFlow = this.mcpAuthorizationFlowRepository.create({
      authorizationJourneyId: savedJourney.id,
      serverId: mcpServer.id,
      clientId: input.mcpClientId,
    });
    const savedFlow = await this.mcpAuthorizationFlowRepository.save(mcpFlow);

    // Start Connection Authorization Flows if the MCP Server has any connections
    const connectionFlows = mcpServer.connections.map(connection => {
      return this.connectionAuthorizationFlowRepository.create({
        authorizationJourneyId: savedJourney.id,
        mcpConnectionId: connection.id,
      })
    });

    const savedConnectionFlows = connectionFlows.length > 0 ? await this.connectionAuthorizationFlowRepository.save(connectionFlows) : [];

    return {
      authorizationJourney: savedJourney,
      mcpAuthorizationFlow: savedFlow,
      connectionAuthorizationFlows: savedConnectionFlows,
    };
  }

  /*
  Debug. Gets all journeys for an MCP Server
  */
  async getJourneysForMcpServer(mcpServerId: string): Promise<AuthJourneyEntity[]> {
    const authJourneys = await this.authJourneyRepository.find(
      {
        where: {
          mcpAuthorizationFlow: {
            serverId: mcpServerId,
          },
        },
        relations: {
          mcpAuthorizationFlow: {
            client: {}
          },
          connectionAuthorizationFlows: {
            mcpConnection: {}
          },
        }
      }
    )
    return authJourneys;
  }
}
