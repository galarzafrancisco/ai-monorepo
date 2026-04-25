import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import {
  AuthJourneyEntity,
  ConnectionAuthorizationFlowEntity,
  McpAuthorizationFlowEntity,
} from './entities';
import { AuthJourneyStatus } from './enums/auth-journey-status.enum';
import {
  AuthJourneyResult,
  ConnectionAuthorizationFlowResult,
  CreateAuthJourneyInput,
  McpAuthorizationFlowResult,
} from './dto/service/auth-journeys.service.types';
import { McpRegistryService } from '../mcp-registry/mcp-registry.service';
import { McpAuthorizationFlowStatus } from './enums/mcp-authorization-flow-status.enum';
import { RegisteredClientEntity } from '../authorization-server/entities/registered-client.entity';

export type PruneStaleClientsResult = {
  cutoff: Date;
  staleFlows: number;
  deletedClients: number;
  deletedJourneys: number;
  deletedMcpFlows: number;
  deletedConnectionFlows: number;
};

@Injectable()
export class AuthJourneysService {
  constructor(
    @InjectRepository(AuthJourneyEntity)
    private readonly authJourneyRepository: Repository<AuthJourneyEntity>,
    @InjectRepository(McpAuthorizationFlowEntity)
    private readonly mcpAuthorizationFlowRepository: Repository<McpAuthorizationFlowEntity>,
    @InjectRepository(ConnectionAuthorizationFlowEntity)
    private readonly connectionAuthorizationFlowRepository: Repository<ConnectionAuthorizationFlowEntity>,

    private readonly mcpRegistryService: McpRegistryService,
  ) {}

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
    const mcpServer = await this.mcpRegistryService.getServerById(
      input.mcpServerId,
    );

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
      status: McpAuthorizationFlowStatus.CLIENT_REGISTERED,
    });
    const savedFlow = await this.mcpAuthorizationFlowRepository.save(mcpFlow);

    // Start Connection Authorization Flows if the MCP Server has any connections
    const connectionFlows = mcpServer.connections.map((connection) => {
      return this.connectionAuthorizationFlowRepository.create({
        authorizationJourneyId: savedJourney.id,
        mcpConnectionId: connection.id,
      });
    });

    const savedConnectionFlows =
      connectionFlows.length > 0
        ? await this.connectionAuthorizationFlowRepository.save(connectionFlows)
        : [];

    return {
      authorizationJourney: savedJourney,
      mcpAuthorizationFlow: savedFlow,
      connectionAuthorizationFlows: savedConnectionFlows,
    };
  }

  /*
  Debug. Gets all journeys for an MCP Server
  */
  async getJourneysForMcpServer(
    mcpServerId: string,
  ): Promise<AuthJourneyResult[]> {
    const authJourneys = await this.authJourneyRepository.find({
      where: {
        mcpAuthorizationFlow: {
          serverId: mcpServerId,
        },
      },
      relations: {
        actor: true,
        mcpAuthorizationFlow: {
          client: {},
        },
        connectionAuthorizationFlows: {
          mcpConnection: {},
        },
      },
    });
    return authJourneys.map((journey) => this.mapAuthJourneyToResult(journey));
  }

  /*
  Public API: Find MCP authorization flow by client ID and server ID
  Used by AuthorizationService to locate existing flows
  */
  async findMcpAuthFlowByClientAndServer(
    clientId: string,
    serverId: string,
    relations?: string[],
  ): Promise<McpAuthorizationFlowEntity | null> {
    return this.mcpAuthorizationFlowRepository.findOne({
      where: {
        clientId,
        serverId,
      },
      relations,
    });
  }

  /*
  Public API: Find MCP authorization flow by flow ID
  Used by AuthorizationService for consent flow
  */
  async findMcpAuthFlowById(
    flowId: string,
    relations?: string[],
  ): Promise<McpAuthorizationFlowEntity | null> {
    return this.mcpAuthorizationFlowRepository.findOne({
      where: { id: flowId },
      relations,
    });
  }

  /*
  Public API: Find MCP authorization flow by authorization code
  Used by TokenService for token exchange
  */
  async findMcpAuthFlowByAuthorizationCode(
    authorizationCode: string,
    relations?: string[],
  ): Promise<McpAuthorizationFlowEntity | null> {
    return this.mcpAuthorizationFlowRepository.findOne({
      where: { authorizationCode },
      relations,
    });
  }

  /*
  Public API: Save/update MCP authorization flow
  Used by AuthorizationService and TokenService to update flow state
  */
  async saveMcpAuthFlow(
    mcpAuthFlow: McpAuthorizationFlowEntity,
  ): Promise<McpAuthorizationFlowEntity> {
    return this.mcpAuthorizationFlowRepository.save(mcpAuthFlow);
  }

  /*
  Public API: Get connection authorization flows for an auth journey
  Used by downstream auth flow to process all connections
  */
  async getConnectionFlowsForJourney(
    journeyId: string,
    relations?: string[],
  ): Promise<ConnectionAuthorizationFlowEntity[]> {
    return this.connectionAuthorizationFlowRepository.find({
      where: { authorizationJourneyId: journeyId },
      relations,
    });
  }

  /*
  Public API: Find connection authorization flow by state
  Used by callback handler to identify which flow is being completed
  */
  async findConnectionFlowByState(
    state: string,
    relations?: string[],
  ): Promise<ConnectionAuthorizationFlowEntity | null> {
    return this.connectionAuthorizationFlowRepository.findOne({
      where: { state },
      relations,
    });
  }

  /*
  Public API: Save/update connection authorization flow
  Used by downstream auth flow to update connection state
  */
  async saveConnectionFlow(
    connectionFlow: ConnectionAuthorizationFlowEntity,
  ): Promise<ConnectionAuthorizationFlowEntity> {
    return this.connectionAuthorizationFlowRepository.save(connectionFlow);
  }

  private mapAuthJourneyToResult(journey: AuthJourneyEntity): AuthJourneyResult {
    return {
      id: journey.id,
      status: journey.status,
      actor: journey.actor
        ? {
            id: journey.actor.id,
            type: journey.actor.type,
            slug: journey.actor.slug,
            displayName: journey.actor.displayName,
            avatarUrl: journey.actor.avatarUrl,
            introduction: journey.actor.introduction,
          }
        : null,
      mcpAuthorizationFlow: this.mapMcpFlowToResult(
        journey.mcpAuthorizationFlow,
      ),
      connectionAuthorizationFlows: journey.connectionAuthorizationFlows.map(
        (flow) => this.mapConnectionFlowToResult(flow),
      ),
      createdAt: journey.createdAt,
      updatedAt: journey.updatedAt,
    };
  }

  private mapMcpFlowToResult(
    flow: McpAuthorizationFlowEntity,
  ): McpAuthorizationFlowResult {
    return {
      id: flow.id,
      authorizationJourneyId: flow.authorizationJourneyId,
      serverId: flow.serverId,
      clientId: flow.clientId,
      clientName: flow.client?.clientName ?? null,
      status: flow.status,
      scope: flow.scopes?.join(' ') ?? null,
      authorizationCodeExpiresAt: flow.authorizationCodeExpiresAt ?? null,
      authorizationCodeUsed: flow.authorizationCodeUsed,
      createdAt: flow.createdAt,
      updatedAt: flow.updatedAt,
    };
  }

  private mapConnectionFlowToResult(
    flow: ConnectionAuthorizationFlowEntity,
  ): ConnectionAuthorizationFlowResult {
    return {
      id: flow.id,
      authorizationJourneyId: flow.authorizationJourneyId,
      mcpConnectionId: flow.mcpConnectionId,
      connectionName: flow.mcpConnection?.friendlyName ?? null,
      status: flow.status,
      tokenExpiresAt: flow.tokenExpiresAt ?? null,
      createdAt: flow.createdAt,
      updatedAt: flow.updatedAt,
    };
  }

  /*
  Public API: Find MCP authorization flow by auth journey ID
  Used to get the MCP flow when completing the auth journey
  */
  async findMcpAuthFlowByJourneyId(
    journeyId: string,
    relations?: string[],
  ): Promise<McpAuthorizationFlowEntity | null> {
    return this.mcpAuthorizationFlowRepository.findOne({
      where: { authorizationJourneyId: journeyId },
      relations,
    });
  }

  /*
  Public API: Save/update auth journey
  Used to update the auth journey entity
  */
  async saveAuthJourney(
    authJourney: AuthJourneyEntity,
  ): Promise<AuthJourneyEntity> {
    return this.authJourneyRepository.save(authJourney);
  }

  async updateAuthJourneyStatus(
    journeyId: string,
    status: AuthJourneyStatus,
  ): Promise<void> {
    await this.authJourneyRepository.update(journeyId, { status });
  }

  async pruneStaleMcpClients(retentionHours: number): Promise<PruneStaleClientsResult> {
    const cutoff = new Date(Date.now() - retentionHours * 60 * 60 * 1000);

    const staleFlows = await this.mcpAuthorizationFlowRepository
      .createQueryBuilder('flow')
      .innerJoinAndSelect('flow.authJourney', 'journey')
      .innerJoinAndSelect('flow.client', 'client')
      .where('flow.status != :flowCompleted', {
        flowCompleted: McpAuthorizationFlowStatus.AUTHORIZATION_CODE_EXCHANGED,
      })
      .andWhere('journey.status != :journeyCompleted', {
        journeyCompleted: AuthJourneyStatus.AUTHORIZATION_CODE_EXCHANGED,
      })
      .andWhere('flow.updatedAt < :cutoff', { cutoff })
      .andWhere('journey.updatedAt < :cutoff', { cutoff })
      .getMany();

    if (staleFlows.length === 0) {
      return {
        cutoff,
        staleFlows: 0,
        deletedClients: 0,
        deletedJourneys: 0,
        deletedMcpFlows: 0,
        deletedConnectionFlows: 0,
      };
    }

    const clientIds = Array.from(new Set(staleFlows.map(flow => flow.clientId)));
    const journeyIds = Array.from(new Set(staleFlows.map(flow => flow.authorizationJourneyId)));
    const mcpFlowIds = Array.from(new Set(staleFlows.map(flow => flow.id)));

    const result = await this.authJourneyRepository.manager.transaction(async manager => {
      const connectionDelete = await manager.delete(ConnectionAuthorizationFlowEntity, {
        authorizationJourneyId: In(journeyIds),
      });
      const mcpFlowDelete = await manager.delete(McpAuthorizationFlowEntity, {
        id: In(mcpFlowIds),
      });
      const journeyDelete = await manager.delete(AuthJourneyEntity, {
        id: In(journeyIds),
      });
      const clientDelete = await manager.delete(RegisteredClientEntity, {
        id: In(clientIds),
      });

      return {
        deletedClients: clientDelete.affected || 0,
        deletedJourneys: journeyDelete.affected || 0,
        deletedMcpFlows: mcpFlowDelete.affected || 0,
        deletedConnectionFlows: connectionDelete.affected || 0,
      };
    });

    return {
      cutoff,
      staleFlows: staleFlows.length,
      ...result,
    };
  }
}
