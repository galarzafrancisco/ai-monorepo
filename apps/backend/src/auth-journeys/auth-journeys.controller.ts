import {
  Controller,
  Get,
  Logger,
  Param,
  ParseUUIDPipe,
  UseGuards,
} from '@nestjs/common';
import { AuthJourneysService } from './auth-journeys.service';
import { AccessTokenGuard } from 'src/auth/guards/guards/access-token.guard';
import {
  ApiCookieAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import {
  AuthJourneyResponseDto,
  ConnectionFlowResponseDto,
  McpFlowResponseDto,
} from './dto';
import { AuthJourneyEntity } from './entities';

@ApiTags('Authorization Journeys')
@ApiCookieAuth('JWT-Cookie')
@Controller('auth-journeys')
@UseGuards(AccessTokenGuard)
export class AuthJourneysController {
  private logger = new Logger(AuthJourneysController.name);

  constructor(private readonly authJourneysService: AuthJourneysService) {}

  @Get('servers/:serverId')
  @ApiOperation({
    summary: 'Get authorization journeys for an MCP server (debug/monitoring)',
  })
  @ApiParam({ name: 'serverId', description: 'Server UUID' })
  @ApiResponse({
    status: 200,
    description: 'List of authorization journeys',
    type: [AuthJourneyResponseDto],
  })
  @ApiResponse({ status: 404, description: 'Server not found' })
  async getAuthJourneys(
    @Param('serverId', ParseUUIDPipe) serverId: string,
  ): Promise<AuthJourneyResponseDto[]> {
    const journeys =
      await this.authJourneysService.getJourneysForMcpServer(serverId);
    return journeys.map((journey) => this.mapAuthJourneyToResponse(journey));
  }

  private mapAuthJourneyToResponse(
    journey: AuthJourneyEntity,
  ): AuthJourneyResponseDto {
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
      mcpAuthorizationFlow: this.mapMcpFlowToResponse(
        journey.mcpAuthorizationFlow,
      ),
      connectionAuthorizationFlows: journey.connectionAuthorizationFlows.map(
        (flow) => this.mapConnectionFlowToResponse(flow),
      ),
      createdAt: this.formatDate(journey.createdAt),
      updatedAt: this.formatDate(journey.updatedAt),
    };
  }

  private mapMcpFlowToResponse(flow: any): McpFlowResponseDto {
    return {
      id: flow.id,
      authorizationJourneyId: flow.authorizationJourneyId,
      serverId: flow.serverId,
      clientId: flow.clientId,
      clientName: flow.client?.clientName || null,
      status: flow.status,
      scope: flow.scope || null,
      authorizationCodeExpiresAt: flow.authorizationCodeExpiresAt
        ? this.formatDate(flow.authorizationCodeExpiresAt)
        : null,
      authorizationCodeUsed: flow.authorizationCodeUsed,
      createdAt: this.formatDate(flow.createdAt),
      updatedAt: this.formatDate(flow.updatedAt),
    };
  }

  private mapConnectionFlowToResponse(flow: any): ConnectionFlowResponseDto {
    return {
      id: flow.id,
      authorizationJourneyId: flow.authorizationJourneyId,
      mcpConnectionId: flow.mcpConnectionId,
      connectionName: flow.mcpConnection?.friendlyName || null,
      status: flow.status,
      tokenExpiresAt: flow.tokenExpiresAt
        ? this.formatDate(flow.tokenExpiresAt)
        : null,
      createdAt: this.formatDate(flow.createdAt),
      updatedAt: this.formatDate(flow.updatedAt),
    };
  }

  private formatDate(value: Date | string): string {
    return value instanceof Date
      ? value.toISOString()
      : new Date(value).toISOString();
  }
}
