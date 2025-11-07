import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  AuthJourneyEntity,
  McpAuthorizationFlowEntity,
} from './entities';
import { AuthJourneyStatus } from './enums/auth-journey-status.enum';
import { CreateAuthJourneyInput } from './dto/service/auth-journeys.service.types';

@Injectable()
export class AuthJourneysService {
  constructor(
    @InjectRepository(AuthJourneyEntity)
    private readonly authJourneyRepository: Repository<AuthJourneyEntity>,
    @InjectRepository(McpAuthorizationFlowEntity)
    private readonly mcpAuthorizationFlowRepository: Repository<McpAuthorizationFlowEntity>,
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
  }> {

    // Start an Auth journey
    const journey = this.authJourneyRepository.create({
      status: AuthJourneyStatus.MCP_AUTH_FLOW_STARTED,
    });
    const savedJourney = await this.authJourneyRepository.save(journey);

    // Start an MCP Authorization Flow
    const mcpFlow = this.mcpAuthorizationFlowRepository.create({
      authorizationJourneyId: savedJourney.id,
      serverId: input.mcpServerId,
      clientId: input.mcpClientId,
    });
    const savedFlow = await this.mcpAuthorizationFlowRepository.save(mcpFlow);

    return {
      authorizationJourney: savedJourney,
      mcpAuthorizationFlow: savedFlow,
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
          mcpAuthorizationFlow: {},
          connectionAuthorizationFlows: {},
        }
      }
    )
    return authJourneys;
  }
}
