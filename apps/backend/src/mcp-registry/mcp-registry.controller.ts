import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  ParseIntPipe,
  ParseUUIDPipe,
  ParseArrayPipe,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
  ApiBody,
  ApiCookieAuth,
} from '@nestjs/swagger';
import { McpRegistryService } from './mcp-registry.service';
import {
  CreateServerDto,
  UpdateServerDto,
  CreateScopeDto,
  CreateConnectionDto,
  UpdateConnectionDto,
  CreateMappingDto,
  ServerResponseDto,
  ServerListResponseDto,
  ScopeResponseDto,
  ConnectionResponseDto,
  MappingResponseDto,
  DeleteServerResponseDto,
  DeleteScopeResponseDto,
  DeleteConnectionResponseDto,
  DeleteMappingResponseDto,
  ServerRecord,
  ScopeRecord,
  ConnectionRecord,
  MappingRecord,
} from './dto';
import { AccessTokenGuard } from '../auth/guards/guards/access-token.guard';
import { ScopesGuard } from 'src/auth/guards/guards/scopes.guard';
import { McpRegistryScopes } from './mcp-registry.scopes';
import { RequireScopes } from 'src/auth/guards/decorators/require-scopes.decorator';
import { WorkspaceAccess } from '../auth/guards/decorators/workspace-access.decorator';
import { CurrentWorkspace } from '../auth/guards/decorators/current-workspace.decorator';

@ApiTags('Tools')
@ApiCookieAuth('JWT-Cookie')
@WorkspaceAccess('scoped')
@Controller('mcp')
@UseGuards(AccessTokenGuard, ScopesGuard)
@RequireScopes(McpRegistryScopes.READ.id)
export class McpRegistryController {
  constructor(private readonly mcpRegistryService: McpRegistryService) {}

  // Server endpoints

  @Post('servers')
  @RequireScopes(McpRegistryScopes.WRITE.id)
  @ApiOperation({ summary: 'Register a new MCP server' })
  @ApiResponse({
    status: 201,
    description: 'Server created successfully',
    type: ServerResponseDto,
  })
  @ApiResponse({
    status: 409,
    description: 'Server with providedId already exists',
  })
  async createServer(
    @Body() dto: CreateServerDto,
    @CurrentWorkspace() workspaceId: string,
  ): Promise<ServerResponseDto> {
    const server = await this.mcpRegistryService.createServer(workspaceId, {
      providedId: dto.providedId,
      name: dto.name,
      description: dto.description,
      type: dto.type,
      authType: dto.authType,
      url: dto.url,
      cmd: dto.cmd,
      args: dto.args,
    });
    return this.mapServerToResponse(server);
  }

  @Get('servers')
  @ApiOperation({ summary: 'List all MCP servers with pagination' })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 50 })
  @ApiResponse({
    status: 200,
    description: 'List of servers',
    type: ServerListResponseDto,
  })
  async listServers(
    @CurrentWorkspace() workspaceId: string,
    @Query('page', new ParseIntPipe({ optional: true })) page?: number,
    @Query('limit', new ParseIntPipe({ optional: true })) limit?: number,
  ): Promise<ServerListResponseDto> {
    const result = await this.mcpRegistryService.listServers(workspaceId, page, limit);
    return {
      items: result.items.map((server) => this.mapServerToResponse(server)),
      total: result.total,
      page: result.page,
      limit: result.limit,
    };
  }

  @Get('servers/:serverId')
  @ApiOperation({ summary: 'Get MCP server by UUID or provided ID' })
  @ApiParam({ name: 'serverId', description: 'Server UUID or provided ID' })
  @ApiResponse({
    status: 200,
    description: 'Server found',
    type: ServerResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Server not found' })
  // Workers of any workspace also read Taico's baseline servers here, with
  // Taico's built-in transport outside the workspace that holds them.
  async getServer(
    @Param('serverId') serverId: string,
    @CurrentWorkspace() workspaceId: string,
  ): Promise<ServerResponseDto> {
    const server = await this.mcpRegistryService.getServerForWorkspace(
      workspaceId,
      serverId,
      this.isUuid(serverId),
    );
    return this.mapServerToResponse(server);
  }

  @Patch('servers/:serverId')
  @RequireScopes(McpRegistryScopes.WRITE.id)
  @ApiOperation({ summary: 'Update MCP server details' })
  @ApiParam({ name: 'serverId', description: 'Server UUID' })
  @ApiResponse({
    status: 200,
    description: 'Server updated successfully',
    type: ServerResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Server not found' })
  async updateServer(
    @Param('serverId', ParseUUIDPipe) serverId: string,
    @Body() dto: UpdateServerDto,
    @CurrentWorkspace() workspaceId: string,
  ): Promise<ServerResponseDto> {
    const server = await this.mcpRegistryService.updateServer(workspaceId, serverId, dto);
    return this.mapServerToResponse(server);
  }

  @Delete('servers/:serverId')
  @RequireScopes(McpRegistryScopes.WRITE.id)
  @ApiOperation({ summary: 'Delete MCP server (must have no dependencies)' })
  @ApiParam({ name: 'serverId', description: 'Server UUID' })
  @ApiResponse({
    status: 200,
    description: 'Server deleted successfully',
    type: DeleteServerResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Server not found' })
  @ApiResponse({ status: 409, description: 'Server has dependencies' })
  async deleteServer(
    @Param('serverId', ParseUUIDPipe) serverId: string,
    @CurrentWorkspace() workspaceId: string,
  ): Promise<DeleteServerResponseDto> {
    await this.mcpRegistryService.deleteServer(workspaceId, serverId);
    return { message: 'Server deleted successfully' };
  }

  // Scope endpoints

  @Post('servers/:serverId/scopes')
  @RequireScopes(McpRegistryScopes.WRITE.id)
  @ApiOperation({ summary: 'Create MCP scope(s) for a server' })
  @ApiParam({ name: 'serverId', description: 'Server UUID' })
  @ApiBody({
    type: CreateScopeDto,
    isArray: true,
    description: 'Array of scopes to create',
  })
  @ApiResponse({
    status: 201,
    description: 'Scope(s) created successfully',
    type: [ScopeResponseDto],
  })
  @ApiResponse({ status: 404, description: 'Server not found' })
  @ApiResponse({ status: 409, description: 'Scope already exists' })
  async createScopes(
    @Param('serverId', ParseUUIDPipe) serverId: string,
    @Body(new ParseArrayPipe({ items: CreateScopeDto, whitelist: true }))
    dto: CreateScopeDto[],
    @CurrentWorkspace() workspaceId: string,
  ): Promise<ScopeResponseDto[]> {
    const scopes = await this.mcpRegistryService.createScopes(workspaceId, serverId, dto);
    return scopes.map((scope) => this.mapScopeToResponse(scope));
  }

  @Get('servers/:serverId/scopes')
  @ApiOperation({ summary: 'List all scopes for an MCP server' })
  @ApiParam({ name: 'serverId', description: 'Server UUID' })
  @ApiResponse({
    status: 200,
    description: 'List of scopes',
    type: [ScopeResponseDto],
  })
  @ApiResponse({ status: 404, description: 'Server not found' })
  async listScopes(
    @Param('serverId', ParseUUIDPipe) serverId: string,
    @CurrentWorkspace() workspaceId: string,
  ): Promise<ScopeResponseDto[]> {
    const scopes = await this.mcpRegistryService.listScopesByServer(workspaceId, serverId);
    return scopes.map((scope) => this.mapScopeToResponse(scope));
  }

  @Get('servers/:serverId/scopes/:scopeId')
  @ApiOperation({ summary: 'Get a specific MCP scope' })
  @ApiParam({ name: 'serverId', description: 'Server UUID' })
  @ApiParam({ name: 'scopeId', description: 'Scope ID string' })
  @ApiResponse({
    status: 200,
    description: 'Scope found',
    type: ScopeResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Scope not found' })
  async getScope(
    @Param('serverId', ParseUUIDPipe) serverId: string,
    @Param('scopeId') scopeId: string,
    @CurrentWorkspace() workspaceId: string,
  ): Promise<ScopeResponseDto> {
    const scope = await this.mcpRegistryService.getScope(workspaceId, scopeId, serverId);
    return this.mapScopeToResponse(scope);
  }

  @Delete('servers/:serverId/scopes/:scopeId')
  @RequireScopes(McpRegistryScopes.WRITE.id)
  @ApiOperation({ summary: 'Delete MCP scope (must have no mappings)' })
  @ApiParam({ name: 'serverId', description: 'Server UUID' })
  @ApiParam({ name: 'scopeId', description: 'Scope ID string' })
  @ApiResponse({
    status: 200,
    description: 'Scope deleted successfully',
    type: DeleteScopeResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Scope not found' })
  @ApiResponse({ status: 409, description: 'Scope has mappings' })
  async deleteScope(
    @Param('serverId', ParseUUIDPipe) serverId: string,
    @Param('scopeId') scopeId: string,
    @CurrentWorkspace() workspaceId: string,
  ): Promise<DeleteScopeResponseDto> {
    await this.mcpRegistryService.deleteScope(workspaceId, scopeId, serverId);
    return { message: 'Scope deleted successfully' };
  }

  // Connection endpoints

  @Post('servers/:serverId/connections')
  @RequireScopes(McpRegistryScopes.WRITE.id)
  @ApiOperation({ summary: 'Create OAuth connection for an MCP server' })
  @ApiParam({ name: 'serverId', description: 'Server UUID' })
  @ApiResponse({
    status: 201,
    description: 'Connection created successfully',
    type: ConnectionResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Server not found' })
  @ApiResponse({ status: 409, description: 'Connection name conflict' })
  async createConnection(
    @Param('serverId', ParseUUIDPipe) serverId: string,
    @Body() dto: CreateConnectionDto,
    @CurrentWorkspace() workspaceId: string,
  ): Promise<ConnectionResponseDto> {
    const connection = await this.mcpRegistryService.createConnection(
      workspaceId,
      serverId,
      dto,
    );
    return this.mapConnectionToResponse(connection);
  }

  @Get('servers/:serverId/connections')
  @ApiOperation({ summary: 'List all connections for an MCP server' })
  @ApiParam({ name: 'serverId', description: 'Server UUID' })
  @ApiResponse({
    status: 200,
    description: 'List of connections',
    type: [ConnectionResponseDto],
  })
  @ApiResponse({ status: 404, description: 'Server not found' })
  async listConnections(
    @Param('serverId', ParseUUIDPipe) serverId: string,
    @CurrentWorkspace() workspaceId: string,
  ): Promise<ConnectionResponseDto[]> {
    const connections =
      await this.mcpRegistryService.listConnectionsByServer(workspaceId, serverId);
    return connections.map((conn) => this.mapConnectionToResponse(conn));
  }

  @Get('connections/:connectionId')
  @ApiOperation({ summary: 'Get a specific connection' })
  @ApiParam({ name: 'connectionId', description: 'Connection UUID' })
  @ApiResponse({
    status: 200,
    description: 'Connection found',
    type: ConnectionResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Connection not found' })
  async getConnection(
    @Param('connectionId', ParseUUIDPipe) connectionId: string,
    @CurrentWorkspace() workspaceId: string,
  ): Promise<ConnectionResponseDto> {
    const connection =
      await this.mcpRegistryService.getConnection(workspaceId, connectionId);
    return this.mapConnectionToResponse(connection);
  }

  @Patch('connections/:connectionId')
  @RequireScopes(McpRegistryScopes.WRITE.id)
  @ApiOperation({ summary: 'Update connection details' })
  @ApiParam({ name: 'connectionId', description: 'Connection UUID' })
  @ApiResponse({
    status: 200,
    description: 'Connection updated successfully',
    type: ConnectionResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Connection not found' })
  @ApiResponse({ status: 409, description: 'Connection name conflict' })
  async updateConnection(
    @Param('connectionId', ParseUUIDPipe) connectionId: string,
    @Body() dto: UpdateConnectionDto,
    @CurrentWorkspace() workspaceId: string,
  ): Promise<ConnectionResponseDto> {
    const connection = await this.mcpRegistryService.updateConnection(
      workspaceId,
      connectionId,
      dto,
    );
    return this.mapConnectionToResponse(connection);
  }

  @Delete('connections/:connectionId')
  @RequireScopes(McpRegistryScopes.WRITE.id)
  @ApiOperation({ summary: 'Delete connection (must have no mappings)' })
  @ApiParam({ name: 'connectionId', description: 'Connection UUID' })
  @ApiResponse({
    status: 200,
    description: 'Connection deleted successfully',
    type: DeleteConnectionResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Connection not found' })
  @ApiResponse({ status: 409, description: 'Connection has mappings' })
  async deleteConnection(
    @Param('connectionId', ParseUUIDPipe) connectionId: string,
    @CurrentWorkspace() workspaceId: string,
  ): Promise<DeleteConnectionResponseDto> {
    await this.mcpRegistryService.deleteConnection(workspaceId, connectionId);
    return { message: 'Connection deleted successfully' };
  }

  // Mapping endpoints

  @Post('servers/:serverId/mappings')
  @RequireScopes(McpRegistryScopes.WRITE.id)
  @ApiOperation({ summary: 'Create scope mapping' })
  @ApiParam({ name: 'serverId', description: 'Server UUID' })
  @ApiResponse({
    status: 201,
    description: 'Mapping created successfully',
    type: MappingResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Scope or connection not found' })
  @ApiResponse({ status: 400, description: 'Invalid mapping' })
  async createMapping(
    @Param('serverId', ParseUUIDPipe) serverId: string,
    @Body() dto: CreateMappingDto,
    @CurrentWorkspace() workspaceId: string,
  ): Promise<MappingResponseDto> {
    const mapping = await this.mcpRegistryService.createMapping(workspaceId, serverId, dto);
    return this.mapMappingToResponse(mapping);
  }

  @Get('servers/:serverId/scopes/:scopeId/mappings')
  @ApiOperation({ summary: 'List downstream scopes for an MCP scope' })
  @ApiParam({ name: 'serverId', description: 'Server UUID' })
  @ApiParam({ name: 'scopeId', description: 'Scope ID string' })
  @ApiResponse({
    status: 200,
    description: 'List of mappings',
    type: [MappingResponseDto],
  })
  @ApiResponse({ status: 404, description: 'Scope not found' })
  async listMappings(
    @Param('serverId', ParseUUIDPipe) serverId: string,
    @Param('scopeId') scopeId: string,
    @CurrentWorkspace() workspaceId: string,
  ): Promise<MappingResponseDto[]> {
    const mappings = await this.mcpRegistryService.listMappingsByScope(
      workspaceId,
      scopeId,
      serverId,
    );
    return mappings.map((mapping) => this.mapMappingToResponse(mapping));
  }

  @Delete('mappings/:mappingId')
  @RequireScopes(McpRegistryScopes.WRITE.id)
  @ApiOperation({ summary: 'Delete scope mapping' })
  @ApiParam({ name: 'mappingId', description: 'Mapping UUID' })
  @ApiResponse({
    status: 200,
    description: 'Mapping deleted successfully',
    type: DeleteMappingResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Mapping not found' })
  async deleteMapping(
    @Param('mappingId', ParseUUIDPipe) mappingId: string,
    @CurrentWorkspace() workspaceId: string,
  ): Promise<DeleteMappingResponseDto> {
    await this.mcpRegistryService.deleteMapping(workspaceId, mappingId);
    return { message: 'Mapping deleted successfully' };
  }

  // Helper methods
  private isUuid(str: string): boolean {
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return uuidRegex.test(str);
  }

  private mapServerToResponse(server: ServerRecord): ServerResponseDto {
    return {
      id: server.id,
      providedId: server.providedId,
      name: server.name,
      description: server.description,
      type: server.type,
      authType: server.authType,
      requiresTaicoAuth: server.requiresTaicoAuth,
      url: server.url,
      cmd: server.cmd,
      args: server.args,
      createdAt: this.formatDate(server.createdAt),
      updatedAt: this.formatDate(server.updatedAt),
    };
  }

  private mapScopeToResponse(scope: ScopeRecord): ScopeResponseDto {
    return {
      id: scope.id,
      serverId: scope.serverId,
      description: scope.description,
      createdAt: this.formatDate(scope.createdAt),
      updatedAt: this.formatDate(scope.updatedAt),
    };
  }

  private mapConnectionToResponse(
    connection: ConnectionRecord,
  ): ConnectionResponseDto {
    return {
      id: connection.id,
      serverId: connection.serverId,
      friendlyName: connection.friendlyName,
      clientId: connection.clientId,
      clientSecret: null, // Never expose client secret
      authorizeUrl: connection.authorizeUrl,
      tokenUrl: connection.tokenUrl,
      createdAt: this.formatDate(connection.createdAt),
      updatedAt: this.formatDate(connection.updatedAt),
    };
  }

  private mapMappingToResponse(mapping: MappingRecord): MappingResponseDto {
    return {
      id: mapping.id,
      scopeId: mapping.scopeId,
      serverId: mapping.serverId,
      connectionId: mapping.connectionId,
      downstreamScope: mapping.downstreamScope,
      createdAt: this.formatDate(mapping.createdAt),
      updatedAt: this.formatDate(mapping.updatedAt),
    };
  }

  private formatDate(value: Date | string): string {
    return value instanceof Date
      ? value.toISOString()
      : new Date(value).toISOString();
  }
}
