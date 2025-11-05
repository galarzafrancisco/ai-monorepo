import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  Query,
  ParseIntPipe,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiQuery } from '@nestjs/swagger';
import { McpRegistryService } from './mcp-registry.service';
import {
  CreateServerDto,
  CreateScopeDto,
  CreateConnectionDto,
  CreateMappingDto,
} from './dto';

@ApiTags('MCP Registry')
@Controller('mcp')
export class McpRegistryController {
  constructor(private readonly mcpRegistryService: McpRegistryService) {}

  // Server endpoints

  @Post('servers')
  @ApiOperation({ summary: 'Register a new MCP server' })
  @ApiResponse({ status: 201, description: 'Server created successfully' })
  @ApiResponse({ status: 409, description: 'Server with providedId already exists' })
  async createServer(@Body() dto: CreateServerDto) {
    return this.mcpRegistryService.createServer(dto);
  }

  @Get('servers')
  @ApiOperation({ summary: 'List all MCP servers with pagination' })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 50 })
  @ApiResponse({ status: 200, description: 'List of servers' })
  async listServers(
    @Query('page', new ParseIntPipe({ optional: true })) page?: number,
    @Query('limit', new ParseIntPipe({ optional: true })) limit?: number,
  ) {
    return this.mcpRegistryService.listServers(page, limit);
  }

  @Get('servers/:serverId')
  @ApiOperation({ summary: 'Get MCP server by UUID or provided ID' })
  @ApiParam({ name: 'serverId', description: 'Server UUID or provided ID' })
  @ApiResponse({ status: 200, description: 'Server found' })
  @ApiResponse({ status: 404, description: 'Server not found' })
  async getServer(@Param('serverId') serverId: string) {
    // Try UUID first, then providedId
    if (this.isUuid(serverId)) {
      return this.mcpRegistryService.getServerById(serverId);
    } else {
      return this.mcpRegistryService.getServerByProvidedId(serverId);
    }
  }

  @Delete('servers/:serverId')
  @ApiOperation({ summary: 'Delete MCP server (must have no dependencies)' })
  @ApiParam({ name: 'serverId', description: 'Server UUID' })
  @ApiResponse({ status: 204, description: 'Server deleted successfully' })
  @ApiResponse({ status: 404, description: 'Server not found' })
  @ApiResponse({ status: 409, description: 'Server has dependencies' })
  async deleteServer(@Param('serverId', ParseUUIDPipe) serverId: string) {
    await this.mcpRegistryService.deleteServer(serverId);
    return { message: 'Server deleted successfully' };
  }

  // Scope endpoints

  @Post('servers/:serverId/scopes')
  @ApiOperation({ summary: 'Create MCP scope(s) for a server' })
  @ApiParam({ name: 'serverId', description: 'Server UUID' })
  @ApiResponse({ status: 201, description: 'Scope(s) created successfully' })
  @ApiResponse({ status: 404, description: 'Server not found' })
  @ApiResponse({ status: 409, description: 'Scope already exists' })
  async createScopes(
    @Param('serverId', ParseUUIDPipe) serverId: string,
    @Body() dto: CreateScopeDto | CreateScopeDto[],
  ) {
    if (Array.isArray(dto)) {
      return this.mcpRegistryService.createScopes(serverId, dto);
    } else {
      return this.mcpRegistryService.createScope(serverId, dto);
    }
  }

  @Get('servers/:serverId/scopes')
  @ApiOperation({ summary: 'List all scopes for an MCP server' })
  @ApiParam({ name: 'serverId', description: 'Server UUID' })
  @ApiResponse({ status: 200, description: 'List of scopes' })
  @ApiResponse({ status: 404, description: 'Server not found' })
  async listScopes(@Param('serverId', ParseUUIDPipe) serverId: string) {
    return this.mcpRegistryService.listScopesByServer(serverId);
  }

  @Get('servers/:serverId/scopes/:scopeId')
  @ApiOperation({ summary: 'Get a specific MCP scope' })
  @ApiParam({ name: 'serverId', description: 'Server UUID' })
  @ApiParam({ name: 'scopeId', description: 'Scope ID string' })
  @ApiResponse({ status: 200, description: 'Scope found' })
  @ApiResponse({ status: 404, description: 'Scope not found' })
  async getScope(
    @Param('serverId', ParseUUIDPipe) serverId: string,
    @Param('scopeId') scopeId: string,
  ) {
    return this.mcpRegistryService.getScope(scopeId, serverId);
  }

  @Delete('servers/:serverId/scopes/:scopeId')
  @ApiOperation({ summary: 'Delete MCP scope (must have no mappings)' })
  @ApiParam({ name: 'serverId', description: 'Server UUID' })
  @ApiParam({ name: 'scopeId', description: 'Scope ID string' })
  @ApiResponse({ status: 204, description: 'Scope deleted successfully' })
  @ApiResponse({ status: 404, description: 'Scope not found' })
  @ApiResponse({ status: 409, description: 'Scope has mappings' })
  async deleteScope(
    @Param('serverId', ParseUUIDPipe) serverId: string,
    @Param('scopeId') scopeId: string,
  ) {
    await this.mcpRegistryService.deleteScope(scopeId, serverId);
    return { message: 'Scope deleted successfully' };
  }

  // Connection endpoints

  @Post('servers/:serverId/connections')
  @ApiOperation({ summary: 'Create OAuth connection for an MCP server' })
  @ApiParam({ name: 'serverId', description: 'Server UUID' })
  @ApiResponse({ status: 201, description: 'Connection created successfully' })
  @ApiResponse({ status: 404, description: 'Server not found' })
  @ApiResponse({ status: 409, description: 'Connection name conflict' })
  async createConnection(
    @Param('serverId', ParseUUIDPipe) serverId: string,
    @Body() dto: CreateConnectionDto,
  ) {
    return this.mcpRegistryService.createConnection(serverId, dto);
  }

  @Get('servers/:serverId/connections')
  @ApiOperation({ summary: 'List all connections for an MCP server' })
  @ApiParam({ name: 'serverId', description: 'Server UUID' })
  @ApiResponse({ status: 200, description: 'List of connections' })
  @ApiResponse({ status: 404, description: 'Server not found' })
  async listConnections(@Param('serverId', ParseUUIDPipe) serverId: string) {
    return this.mcpRegistryService.listConnectionsByServer(serverId);
  }

  @Get('connections/:connectionId')
  @ApiOperation({ summary: 'Get a specific connection' })
  @ApiParam({ name: 'connectionId', description: 'Connection UUID' })
  @ApiResponse({ status: 200, description: 'Connection found' })
  @ApiResponse({ status: 404, description: 'Connection not found' })
  async getConnection(
    @Param('connectionId', ParseUUIDPipe) connectionId: string,
  ) {
    return this.mcpRegistryService.getConnection(connectionId);
  }

  @Delete('connections/:connectionId')
  @ApiOperation({ summary: 'Delete connection (must have no mappings)' })
  @ApiParam({ name: 'connectionId', description: 'Connection UUID' })
  @ApiResponse({ status: 204, description: 'Connection deleted successfully' })
  @ApiResponse({ status: 404, description: 'Connection not found' })
  @ApiResponse({ status: 409, description: 'Connection has mappings' })
  async deleteConnection(
    @Param('connectionId', ParseUUIDPipe) connectionId: string,
  ) {
    await this.mcpRegistryService.deleteConnection(connectionId);
    return { message: 'Connection deleted successfully' };
  }

  // Mapping endpoints

  @Post('servers/:serverId/mappings')
  @ApiOperation({ summary: 'Create scope mapping' })
  @ApiParam({ name: 'serverId', description: 'Server UUID' })
  @ApiResponse({ status: 201, description: 'Mapping created successfully' })
  @ApiResponse({ status: 404, description: 'Scope or connection not found' })
  @ApiResponse({ status: 400, description: 'Invalid mapping' })
  async createMapping(
    @Param('serverId', ParseUUIDPipe) serverId: string,
    @Body() dto: CreateMappingDto,
  ) {
    return this.mcpRegistryService.createMapping(serverId, dto);
  }

  @Get('servers/:serverId/scopes/:scopeId/mappings')
  @ApiOperation({ summary: 'List downstream scopes for an MCP scope' })
  @ApiParam({ name: 'serverId', description: 'Server UUID' })
  @ApiParam({ name: 'scopeId', description: 'Scope ID string' })
  @ApiResponse({ status: 200, description: 'List of mappings' })
  @ApiResponse({ status: 404, description: 'Scope not found' })
  async listMappings(
    @Param('serverId', ParseUUIDPipe) serverId: string,
    @Param('scopeId') scopeId: string,
  ) {
    return this.mcpRegistryService.listMappingsByScope(scopeId, serverId);
  }

  @Delete('mappings/:mappingId')
  @ApiOperation({ summary: 'Delete scope mapping' })
  @ApiParam({ name: 'mappingId', description: 'Mapping UUID' })
  @ApiResponse({ status: 204, description: 'Mapping deleted successfully' })
  @ApiResponse({ status: 404, description: 'Mapping not found' })
  async deleteMapping(@Param('mappingId', ParseUUIDPipe) mappingId: string) {
    await this.mcpRegistryService.deleteMapping(mappingId);
    return { message: 'Mapping deleted successfully' };
  }

  // Helper method
  private isUuid(str: string): boolean {
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return uuidRegex.test(str);
  }
}
