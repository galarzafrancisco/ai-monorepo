import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Put,
  UseGuards,
} from '@nestjs/common';
import {
  ApiCookieAuth,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { AccessTokenGuard } from '../auth/guards/guards/access-token.guard';
import { ScopesGuard } from '../auth/guards/guards/scopes.guard';
import { RequireScopes } from '../auth/guards/decorators/require-scopes.decorator';
import { AgentsScopes } from './agents.scopes';
import { AgentActorParamsDto } from './dto/agent-actor-params.dto';
import { UpsertAgentToolPermissionDto } from './dto/upsert-agent-tool-permission.dto';
import { AgentToolPermissionResponseDto } from './dto/agent-tool-permission-response.dto';
import { AgentToolPermissionsService } from './agent-tool-permissions.service';
import { WorkspaceAccess } from '../auth/guards/decorators/workspace-access.decorator';
import { CurrentWorkspace } from '../auth/guards/decorators/current-workspace.decorator';

@ApiTags('Agent')
@ApiCookieAuth('JWT-Cookie')
// Grants point at MCP registry servers, which are default-only until phase 3e.
@WorkspaceAccess('default-only')
@Controller('agents/:actorId/tool-permissions')
@UseGuards(AccessTokenGuard, ScopesGuard)
@RequireScopes(AgentsScopes.READ.id)
export class AgentToolPermissionsController {
  constructor(
    private readonly agentToolPermissionsService: AgentToolPermissionsService,
  ) {}

  @Get()
  // Workers read this to set up any workspace's agent. Outside the default
  // workspace it lists only Taico's baseline servers (see the service).
  @WorkspaceAccess('scoped')
  @ApiOperation({ summary: 'List tool permissions for an agent' })
  @ApiOkResponse({ type: [AgentToolPermissionResponseDto] })
  async listAgentToolPermissions(
    @Param() params: AgentActorParamsDto,
    @CurrentWorkspace() workspaceId: string,
  ): Promise<AgentToolPermissionResponseDto[]> {
    const permissions =
      await this.agentToolPermissionsService.listAgentToolPermissions(
        workspaceId,
        params.actorId,
      );
    return permissions.map((permission) =>
      AgentToolPermissionResponseDto.fromRecord(permission),
    );
  }

  @Put(':serverId')
  @RequireScopes(AgentsScopes.WRITE.id)
  @ApiOperation({ summary: 'Create or replace an agent tool permission assignment' })
  @ApiOkResponse({ type: AgentToolPermissionResponseDto })
  async upsertAgentToolPermission(
    @Param('actorId', ParseUUIDPipe) actorId: string,
    @Param('serverId', ParseUUIDPipe) serverId: string,
    @Body() dto: UpsertAgentToolPermissionDto,
    @CurrentWorkspace() workspaceId: string,
  ): Promise<AgentToolPermissionResponseDto> {
    const permission =
      await this.agentToolPermissionsService.upsertAgentToolPermission(
        workspaceId,
        actorId,
        serverId,
        {
          scopeIds: dto.scopeIds,
        },
      );
    return AgentToolPermissionResponseDto.fromRecord(permission);
  }

  @Delete(':serverId')
  @RequireScopes(AgentsScopes.WRITE.id)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete an agent tool permission assignment' })
  @ApiNoContentResponse()
  async deleteAgentToolPermission(
    @Param('actorId', ParseUUIDPipe) actorId: string,
    @Param('serverId', ParseUUIDPipe) serverId: string,
    @CurrentWorkspace() workspaceId: string,
  ): Promise<void> {
    await this.agentToolPermissionsService.deleteAgentToolPermission(
      workspaceId,
      actorId,
      serverId,
    );
  }
}
