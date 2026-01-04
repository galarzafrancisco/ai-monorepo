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
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiQuery, ApiBody, ApiCookieAuth } from '@nestjs/swagger';
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
import { AuthJourneysService } from '../auth-journeys/auth-journeys.service';
import { AuthJourneyResponseDto, McpFlowResponseDto, ConnectionFlowResponseDto } from '../auth-journeys/dto';
import { AuthJourneyEntity } from '../auth-journeys/entities';
import { JwtAuthGuard } from '../authorization-server/guards/jwt-auth.guard';

@ApiTags('MCP Registry')
@ApiCookieAuth('JWT-Cookie')
@Controller('mcp')
@UseGuards(JwtAuthGuard)
export class McpRegistryController {
  constructor(
    private readonly mcpRegistryService: McpRegistryService,
    private readonly authJourneysService: AuthJourneysService,
  ) {}

  // Server endpoints

  @Post('servers')
  @ApiOperation({ summary: 'Register a new MCP server' })
  @ApiResponse({ status: 201, description: 'Server created successfully', type: ServerResponseDto })
  @ApiResponse({ status: 409, description: 'Server with providedId already exists' })
  async createServer(@Body() dto: CreateServerDto): Promise<ServerResponseDto> {
    const server = await this.mcpRegistryService.createServer(dto);
    return this.mapServerToResponse(server);
  }

  @Get('servers')
  @ApiOperation({ summary: 'List all MCP servers with pagination' })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 50 })
  @ApiResponse({ status: 200, description: 'List of servers', type: ServerListResponseDto })
  async listServers(
    @Query('page', new ParseIntPipe({ optional: true })) page?: number,
    @Query('limit', new ParseIntPipe({ optional: true })) limit?: number,
  ): Promise<ServerListResponseDto> {
    const result = await this.mcpRegistryService.listServers(page, limit);
    return {
      items: result.items.map(server => this.mapServerToResponse(server)),
      total: result.total,
      page: result.page,
      limit: result.limit,
    };
  }

  @Get('servers/:serverId')
  @ApiOperation({ summary: 'Get MCP server by UUID or provided ID' })
  @ApiParam({ name: 'serverId', description: 'Server UUID or provided ID' })
  @ApiResponse({ status: 200, description: 'Server found', type: ServerResponseDto })
  @ApiResponse({ status: 404, description: 'Server not found' })
  async getServer(@Param('serverId') serverId: string): Promise<ServerResponseDto> {
    // Try UUID first, then providedId
    const server = this.isUuid(serverId)
      ? await this.mcpRegistryService.getServerById(serverId)
      : await this.mcpRegistryService.getServerByProvidedId(serverId);
    return this.mapServerToResponse(server);
  }

  @Patch('servers/:serverId')
  @ApiOperation({ summary: 'Update MCP server details' })
  @ApiParam({ name: 'serverId', description: 'Server UUID' })
  @ApiResponse({ status: 200, description: 'Server updated successfully', type: ServerResponseDto })
  @ApiResponse({ status: 404, description: 'Server not found' })
  async updateServer(
    @Param('serverId', ParseUUIDPipe) serverId: string,
    @Body() dto: UpdateServerDto,
  ): Promise<ServerResponseDto> {
    const server = await this.mcpRegistryService.updateServer(serverId, dto);
    return this.mapServerToResponse(server);
  }

  @Delete('servers/:serverId')
  @ApiOperation({ summary: 'Delete MCP server (must have no dependencies)' })
  @ApiParam({ name: 'serverId', description: 'Server UUID' })
  @ApiResponse({ status: 200, description: 'Server deleted successfully', type: DeleteServerResponseDto })
  @ApiResponse({ status: 404, description: 'Server not found' })
  @ApiResponse({ status: 409, description: 'Server has dependencies' })
  async deleteServer(
    @Param('serverId', ParseUUIDPipe) serverId: string,
  ): Promise<DeleteServerResponseDto> {
    await this.mcpRegistryService.deleteServer(serverId);
    return { message: 'Server deleted successfully' };
  }

  // Scope endpoints

  @Post('servers/:serverId/scopes')
  @ApiOperation({ summary: 'Create MCP scope(s) for a server' })
  @ApiParam({ name: 'serverId', description: 'Server UUID' })
  @ApiBody({ type: CreateScopeDto, isArray: true, description: 'Array of scopes to create' })
  @ApiResponse({ status: 201, description: 'Scope(s) created successfully', type: [ScopeResponseDto] })
  @ApiResponse({ status: 404, description: 'Server not found' })
  @ApiResponse({ status: 409, description: 'Scope already exists' })
  async createScopes(
    @Param('serverId', ParseUUIDPipe) serverId: string,
    @Body(new ParseArrayPipe({ items: CreateScopeDto, whitelist: true }))
    dto: CreateScopeDto[],
  ): Promise<ScopeResponseDto[]> {
    const scopes = await this.mcpRegistryService.createScopes(serverId, dto);
    return scopes.map(scope => this.mapScopeToResponse(scope));
  }

  @Get('servers/:serverId/scopes')
  @ApiOperation({ summary: 'List all scopes for an MCP server' })
  @ApiParam({ name: 'serverId', description: 'Server UUID' })
  @ApiResponse({ status: 200, description: 'List of scopes', type: [ScopeResponseDto] })
  @ApiResponse({ status: 404, description: 'Server not found' })
  async listScopes(@Param('serverId', ParseUUIDPipe) serverId: string): Promise<ScopeResponseDto[]> {
    const scopes = await this.mcpRegistryService.listScopesByServer(serverId);
    return scopes.map(scope => this.mapScopeToResponse(scope));
  }

  @Get('servers/:serverId/scopes/:scopeId')
  @ApiOperation({ summary: 'Get a specific MCP scope' })
  @ApiParam({ name: 'serverId', description: 'Server UUID' })
  @ApiParam({ name: 'scopeId', description: 'Scope ID string' })
  @ApiResponse({ status: 200, description: 'Scope found', type: ScopeResponseDto })
  @ApiResponse({ status: 404, description: 'Scope not found' })
  async getScope(
    @Param('serverId', ParseUUIDPipe) serverId: string,
    @Param('scopeId') scopeId: string,
  ): Promise<ScopeResponseDto> {
    const scope = await this.mcpRegistryService.getScope(scopeId, serverId);
    return this.mapScopeToResponse(scope);
  }

  @Delete('servers/:serverId/scopes/:scopeId')
  @ApiOperation({ summary: 'Delete MCP scope (must have no mappings)' })
  @ApiParam({ name: 'serverId', description: 'Server UUID' })
  @ApiParam({ name: 'scopeId', description: 'Scope ID string' })
  @ApiResponse({ status: 200, description: 'Scope deleted successfully', type: DeleteScopeResponseDto })
  @ApiResponse({ status: 404, description: 'Scope not found' })
  @ApiResponse({ status: 409, description: 'Scope has mappings' })
  async deleteScope(
    @Param('serverId', ParseUUIDPipe) serverId: string,
    @Param('scopeId') scopeId: string,
  ): Promise<DeleteScopeResponseDto> {
    await this.mcpRegistryService.deleteScope(scopeId, serverId);
    return { message: 'Scope deleted successfully' };
  }

  // Connection endpoints

  @Post('servers/:serverId/connections')
  @ApiOperation({ summary: 'Create OAuth connection for an MCP server' })
  @ApiParam({ name: 'serverId', description: 'Server UUID' })
  @ApiResponse({ status: 201, description: 'Connection created successfully', type: ConnectionResponseDto })
  @ApiResponse({ status: 404, description: 'Server not found' })
  @ApiResponse({ status: 409, description: 'Connection name conflict' })
  async createConnection(
    @Param('serverId', ParseUUIDPipe) serverId: string,
    @Body() dto: CreateConnectionDto,
  ): Promise<ConnectionResponseDto> {
    const connection = await this.mcpRegistryService.createConnection(serverId, dto);
    return this.mapConnectionToResponse(connection);
  }

  @Get('servers/:serverId/connections')
  @ApiOperation({ summary: 'List all connections for an MCP server' })
  @ApiParam({ name: 'serverId', description: 'Server UUID' })
  @ApiResponse({ status: 200, description: 'List of connections', type: [ConnectionResponseDto] })
  @ApiResponse({ status: 404, description: 'Server not found' })
  async listConnections(@Param('serverId', ParseUUIDPipe) serverId: string): Promise<ConnectionResponseDto[]> {
    const connections = await this.mcpRegistryService.listConnectionsByServer(serverId);
    return connections.map(conn => this.mapConnectionToResponse(conn));
  }

  @Get('connections/:connectionId')
  @ApiOperation({ summary: 'Get a specific connection' })
  @ApiParam({ name: 'connectionId', description: 'Connection UUID' })
  @ApiResponse({ status: 200, description: 'Connection found', type: ConnectionResponseDto })
  @ApiResponse({ status: 404, description: 'Connection not found' })
  async getConnection(
    @Param('connectionId', ParseUUIDPipe) connectionId: string,
  ): Promise<ConnectionResponseDto> {
    const connection = await this.mcpRegistryService.getConnection(connectionId);
    return this.mapConnectionToResponse(connection);
  }

  @Patch('connections/:connectionId')
  @ApiOperation({ summary: 'Update connection details' })
  @ApiParam({ name: 'connectionId', description: 'Connection UUID' })
  @ApiResponse({ status: 200, description: 'Connection updated successfully', type: ConnectionResponseDto })
  @ApiResponse({ status: 404, description: 'Connection not found' })
  @ApiResponse({ status: 409, description: 'Connection name conflict' })
  async updateConnection(
    @Param('connectionId', ParseUUIDPipe) connectionId: string,
    @Body() dto: UpdateConnectionDto,
  ): Promise<ConnectionResponseDto> {
    const connection = await this.mcpRegistryService.updateConnection(connectionId, dto);
    return this.mapConnectionToResponse(connection);
  }

  @Delete('connections/:connectionId')
  @ApiOperation({ summary: 'Delete connection (must have no mappings)' })
  @ApiParam({ name: 'connectionId', description: 'Connection UUID' })
  @ApiResponse({ status: 200, description: 'Connection deleted successfully', type: DeleteConnectionResponseDto })
  @ApiResponse({ status: 404, description: 'Connection not found' })
  @ApiResponse({ status: 409, description: 'Connection has mappings' })
  async deleteConnection(
    @Param('connectionId', ParseUUIDPipe) connectionId: string,
  ): Promise<DeleteConnectionResponseDto> {
    await this.mcpRegistryService.deleteConnection(connectionId);
    return { message: 'Connection deleted successfully' };
  }

  // Mapping endpoints

  @Post('servers/:serverId/mappings')
  @ApiOperation({ summary: 'Create scope mapping' })
  @ApiParam({ name: 'serverId', description: 'Server UUID' })
  @ApiResponse({ status: 201, description: 'Mapping created successfully', type: MappingResponseDto })
  @ApiResponse({ status: 404, description: 'Scope or connection not found' })
  @ApiResponse({ status: 400, description: 'Invalid mapping' })
  async createMapping(
    @Param('serverId', ParseUUIDPipe) serverId: string,
    @Body() dto: CreateMappingDto,
  ): Promise<MappingResponseDto> {
    const mapping = await this.mcpRegistryService.createMapping(serverId, dto);
    return this.mapMappingToResponse(mapping);
  }

  @Get('servers/:serverId/scopes/:scopeId/mappings')
  @ApiOperation({ summary: 'List downstream scopes for an MCP scope' })
  @ApiParam({ name: 'serverId', description: 'Server UUID' })
  @ApiParam({ name: 'scopeId', description: 'Scope ID string' })
  @ApiResponse({ status: 200, description: 'List of mappings', type: [MappingResponseDto] })
  @ApiResponse({ status: 404, description: 'Scope not found' })
  async listMappings(
    @Param('serverId', ParseUUIDPipe) serverId: string,
    @Param('scopeId') scopeId: string,
  ): Promise<MappingResponseDto[]> {
    const mappings = await this.mcpRegistryService.listMappingsByScope(scopeId, serverId);
    return mappings.map(mapping => this.mapMappingToResponse(mapping));
  }

  @Delete('mappings/:mappingId')
  @ApiOperation({ summary: 'Delete scope mapping' })
  @ApiParam({ name: 'mappingId', description: 'Mapping UUID' })
  @ApiResponse({ status: 200, description: 'Mapping deleted successfully', type: DeleteMappingResponseDto })
  @ApiResponse({ status: 404, description: 'Mapping not found' })
  async deleteMapping(
    @Param('mappingId', ParseUUIDPipe) mappingId: string,
  ): Promise<DeleteMappingResponseDto> {
    await this.mcpRegistryService.deleteMapping(mappingId);
    return { message: 'Mapping deleted successfully' };
  }

  // Auth journeys endpoints

  @Get('servers/:serverId/auth-journeys')
  @ApiOperation({ summary: 'Get authorization journeys for an MCP server (debug/monitoring)' })
  @ApiParam({ name: 'serverId', description: 'Server UUID' })
  @ApiResponse({ status: 200, description: 'List of authorization journeys', type: [AuthJourneyResponseDto] })
  @ApiResponse({ status: 404, description: 'Server not found' })
  async getAuthJourneys(
    @Param('serverId', ParseUUIDPipe) serverId: string,
  ): Promise<AuthJourneyResponseDto[]> {
    const journeys = await this.authJourneysService.getJourneysForMcpServer(serverId);
    return journeys.map(journey => this.mapAuthJourneyToResponse(journey));
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
      url: server.url,
      createdAt: this.formatDate(server.createdAt),
      updatedAt: this.formatDate(server.updatedAt),
    };
  }

  private mapScopeToResponse(scope: ScopeRecord): ScopeResponseDto {
    return {
      id: scope.id,
      scopeId: scope.scopeId,
      serverId: scope.serverId,
      description: scope.description,
      createdAt: this.formatDate(scope.createdAt),
      updatedAt: this.formatDate(scope.updatedAt),
    };
  }

  private mapConnectionToResponse(connection: ConnectionRecord): ConnectionResponseDto {
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
    return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
  }

  private mapAuthJourneyToResponse(journey: AuthJourneyEntity): AuthJourneyResponseDto {
    return {
      id: journey.id,
      status: journey.status,
      mcpAuthorizationFlow: this.mapMcpFlowToResponse(journey.mcpAuthorizationFlow),
      connectionAuthorizationFlows: journey.connectionAuthorizationFlows.map(flow =>
        this.mapConnectionFlowToResponse(flow),
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
      tokenExpiresAt: flow.tokenExpiresAt ? this.formatDate(flow.tokenExpiresAt) : null,
      createdAt: this.formatDate(flow.createdAt),
      updatedAt: this.formatDate(flow.updatedAt),
    };
  }
}
