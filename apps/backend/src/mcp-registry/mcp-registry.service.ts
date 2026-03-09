import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, QueryFailedError, Repository } from 'typeorm';
import {
  McpServerEntity,
  McpScopeEntity,
  McpConnectionEntity,
  McpScopeMappingEntity,
} from './entities';
import {
  CreateServerInput,
  UpdateServerInput,
  CreateConnectionInput,
  UpdateConnectionInput,
  CreateMappingInput,
  ServerRecord,
  ServerWithRelationsRecord,
  ListServersResult,
  ScopeRecord,
  ScopeWithMappingsRecord,
  ConnectionRecord,
  ConnectionWithMappingsRecord,
  MappingRecord,
} from './dto/service/mcp-registry.service.types';
import {
  ServerNotFoundError,
  ServerAlreadyExistsError,
  ScopeNotFoundError,
  ScopeAlreadyExistsError,
  ConnectionNotFoundError,
  ConnectionNameConflictError,
  MappingNotFoundError,
  ServerHasDependenciesError,
  ScopeHasMappingsError,
  ConnectionHasMappingsError,
  InvalidMappingError,
  InvalidServerConfigurationError,
} from './errors/mcp-registry.errors';
import { Scope } from 'src/auth/core/types/scope.type';
import {
  MCP_SERVER_TYPE_HTTP,
  MCP_SERVER_TYPE_STDIO,
  MCP_SERVER_TYPES,
  McpServerType,
} from './mcp-server.types';

@Injectable()
export class McpRegistryService {
  // In-memory cache for server providedId -> UUID resolution
  // Used for hot-path operations like token exchange
  private readonly serverIdCache = new Map<string, string>();

  constructor(
    @InjectRepository(McpServerEntity)
    private readonly serverRepository: Repository<McpServerEntity>,
    @InjectRepository(McpScopeEntity)
    private readonly scopeRepository: Repository<McpScopeEntity>,
    @InjectRepository(McpConnectionEntity)
    private readonly connectionRepository: Repository<McpConnectionEntity>,
    @InjectRepository(McpScopeMappingEntity)
    private readonly mappingRepository: Repository<McpScopeMappingEntity>,
  ) {}

  // Server CRUD operations

  async createServer(input: CreateServerInput): Promise<ServerRecord> {
    this.validateServerConfiguration(input);

    // Check for duplicate providedId
    const existing = await this.serverRepository.findOne({
      where: { providedId: input.providedId },
    });

    if (existing) {
      throw new ServerAlreadyExistsError(input.providedId);
    }

    const server = this.serverRepository.create(input);
    const savedServer = await this.serverRepository.save(server);
    return this.mapServerEntityToRecord(savedServer);
  }

  async listServers(
    page: number = 1,
    limit: number = 50,
  ): Promise<ListServersResult> {
    const [items, total] = await this.serverRepository.findAndCount({
      skip: (page - 1) * limit,
      take: limit,
      order: { createdAt: 'DESC' },
    });

    return {
      items: items.map((server) => this.mapServerEntityToRecord(server)),
      total,
      page,
      limit,
    };
  }

  async getServerById(id: string): Promise<ServerWithRelationsRecord> {
    const server = await this.serverRepository.findOne({
      where: { id },
      relations: ['scopes', 'connections'],
    });

    if (!server) {
      throw new ServerNotFoundError(id);
    }

    return {
      ...this.mapServerEntityToRecord(server),
      scopes: (server.scopes ?? []).map((scope) =>
        this.mapScopeEntityToRecord(scope),
      ),
      connections: (server.connections ?? []).map((connection) =>
        this.mapConnectionEntityToRecord(connection),
      ),
    };
  }

  async getServerByProvidedId(
    providedId: string,
  ): Promise<ServerWithRelationsRecord> {
    const server = await this.serverRepository.findOne({
      where: { providedId },
      relations: ['scopes', 'connections'],
    });

    if (!server) {
      throw new ServerNotFoundError(providedId);
    }

    return {
      ...this.mapServerEntityToRecord(server),
      scopes: (server.scopes ?? []).map((scope) =>
        this.mapScopeEntityToRecord(scope),
      ),
      connections: (server.connections ?? []).map((connection) =>
        this.mapConnectionEntityToRecord(connection),
      ),
    };
  }

  /**
   * Resolve MCP Server UUID from providedId with caching
   * Optimized for hot-path operations (e.g., token exchange)
   * @returns Server UUID or null if not found
   */
  async resolveServerIdFromProvidedId(
    providedId: string,
  ): Promise<string | null> {
    // Check cache first
    const cached = this.serverIdCache.get(providedId);
    if (cached) {
      return cached;
    }

    // Query database - only select ID for minimal overhead
    const server = await this.serverRepository.findOne({
      where: { providedId },
      select: ['id'],
    });

    if (server) {
      // Cache the result for future lookups
      this.serverIdCache.set(providedId, server.id);
      return server.id;
    }

    return null;
  }

  async updateServer(
    serverId: string,
    input: UpdateServerInput,
  ): Promise<ServerRecord> {
    const server = await this.serverRepository.findOne({
      where: { id: serverId },
    });

    if (!server) {
      throw new ServerNotFoundError(serverId);
    }

    this.validateServerConfiguration({
      type: (input.type ?? server.type) as McpServerType,
      url: input.url ?? server.url,
      cmd: input.cmd ?? server.cmd,
      args: input.args ?? server.args,
    });

    // Update only provided fields
    Object.assign(server, input);

    const updatedServer = await this.serverRepository.save(server);
    return this.mapServerEntityToRecord(updatedServer);
  }

  async deleteServer(id: string): Promise<void> {
    await this.assertServerExists(id);

    // Check for dependencies
    const scopeCount = await this.scopeRepository.count({
      where: { serverId: id },
    });
    const connectionCount = await this.connectionRepository.count({
      where: { serverId: id },
    });

    if (scopeCount > 0 || connectionCount > 0) {
      throw new ServerHasDependenciesError(id);
    }

    await this.serverRepository.softDelete(id);
  }

  // Scope CRUD operations

  async createScopes(
    serverId: string,
    scopes: Scope[],
  ): Promise<ScopeRecord[]> {
    if (scopes.length === 0) {
      return [];
    }

    await this.assertServerExists(serverId);
    await this.assertHttpServer(serverId, 'Scopes are only supported for HTTP servers.');

    const scopeIds = scopes.map((input) => input.id);
    const duplicateScopeId = this.findDuplicate(scopeIds);

    if (duplicateScopeId) {
      throw new ScopeAlreadyExistsError(duplicateScopeId, serverId);
    }

    const existingScopes = await this.scopeRepository.find({
      where: {
        serverId,
        id: In(scopeIds),
      },
    });

    if (existingScopes.length > 0) {
      throw new ScopeAlreadyExistsError(existingScopes[0].id, serverId);
    }

    const scopeEntities = scopes.map((scope) =>
      this.scopeRepository.create({
        ...scope,
        serverId,
      }),
    );

    const savedScopes = await this.scopeRepository.save(scopeEntities);
    return savedScopes.map((scope) => this.mapScopeEntityToRecord(scope));
  }

  async listScopesByServer(serverId: string): Promise<ScopeRecord[]> {
    // Verify server exists
    await this.assertServerExists(serverId);

    const scopes = await this.scopeRepository.find({
      where: { serverId },
      order: { id: 'ASC' },
    });

    return scopes.map((scope) => this.mapScopeEntityToRecord(scope));
  }

  async getScope(
    id: string,
    serverId: string,
  ): Promise<ScopeWithMappingsRecord> {
    const scope = await this.scopeRepository.findOne({
      where: { id, serverId },
      relations: ['mappings', 'mappings.connection'],
    });

    if (!scope) {
      throw new ScopeNotFoundError(id, serverId);
    }

    return {
      ...this.mapScopeEntityToRecord(scope),
      mappings: (scope.mappings ?? []).map((mapping) =>
        this.mapMappingEntityToRecord(mapping),
      ),
    };
  }

  async deleteScope(id: string, serverId: string): Promise<void> {
    await this.assertScopeExists(id, serverId);

    // Check for mappings
    const mappingCount = await this.mappingRepository.count({
      where: { id, serverId },
    });

    if (mappingCount > 0) {
      throw new ScopeHasMappingsError(id);
    }

    await this.scopeRepository.softDelete({ id, serverId });
  }

  // Connection CRUD operations

  async createConnection(
    serverId: string,
    input: CreateConnectionInput,
  ): Promise<ConnectionRecord> {
    // Verify server exists
    await this.assertServerExists(serverId);
    await this.assertHttpServer(
      serverId,
      'Connections are only supported for HTTP servers.',
    );

    // Check for duplicate friendly name per server
    const existing = await this.connectionRepository.findOne({
      where: { serverId, friendlyName: input.friendlyName },
    });

    if (existing) {
      throw new ConnectionNameConflictError(input.friendlyName, serverId);
    }

    const connection = this.connectionRepository.create({
      ...input,
      serverId,
    });

    const savedConnection = await this.connectionRepository.save(connection);
    return this.mapConnectionEntityToRecord(savedConnection);
  }

  async listConnectionsByServer(serverId: string): Promise<ConnectionRecord[]> {
    // Verify server exists
    await this.assertServerExists(serverId);

    const connections = await this.connectionRepository.find({
      where: { serverId },
      order: { friendlyName: 'ASC' },
    });

    return connections.map((connection) =>
      this.mapConnectionEntityToRecord(connection),
    );
  }

  async getConnection(
    connectionId: string,
  ): Promise<ConnectionWithMappingsRecord> {
    const connection = await this.connectionRepository.findOne({
      where: { id: connectionId },
      relations: ['server', 'mappings'],
    });

    if (!connection) {
      throw new ConnectionNotFoundError(connectionId);
    }

    return {
      ...this.mapConnectionEntityToRecord(connection),
      mappings: (connection.mappings ?? []).map((mapping) =>
        this.mapMappingEntityToRecord(mapping),
      ),
    };
  }

  async updateConnection(
    connectionId: string,
    input: UpdateConnectionInput,
  ): Promise<ConnectionRecord> {
    const connection = await this.connectionRepository.findOne({
      where: { id: connectionId },
    });

    if (!connection) {
      throw new ConnectionNotFoundError(connectionId);
    }

    // If updating friendly name, check for duplicates
    if (input.friendlyName && input.friendlyName !== connection.friendlyName) {
      const existing = await this.connectionRepository.findOne({
        where: {
          serverId: connection.serverId,
          friendlyName: input.friendlyName,
        },
      });

      if (existing) {
        throw new ConnectionNameConflictError(
          input.friendlyName,
          connection.serverId,
        );
      }
    }

    // Update only provided fields
    Object.assign(connection, input);

    const updatedConnection = await this.connectionRepository.save(connection);
    return this.mapConnectionEntityToRecord(updatedConnection);
  }

  async deleteConnection(connectionId: string): Promise<void> {
    const connection = await this.connectionRepository.findOne({
      where: { id: connectionId },
    });

    if (!connection) {
      throw new ConnectionNotFoundError(connectionId);
    }

    // Check for mappings
    const mappingCount = await this.mappingRepository.count({
      where: { connectionId },
    });

    if (mappingCount > 0) {
      throw new ConnectionHasMappingsError(connectionId);
    }

    await this.connectionRepository.softDelete(connectionId);
  }

  // Mapping CRUD operations

  async createMapping(
    serverId: string,
    input: CreateMappingInput,
  ): Promise<MappingRecord> {
    await this.assertHttpServer(
      serverId,
      'Scope mappings are only supported for HTTP servers.',
    );

    // Verify scope exists
    await this.assertScopeExists(input.scopeId, serverId);

    // Verify connection exists and belongs to the same server
    const connection = await this.connectionRepository.findOne({
      where: { id: input.connectionId },
    });

    if (!connection) {
      throw new ConnectionNotFoundError(input.connectionId);
    }

    if (connection.serverId !== serverId) {
      throw new InvalidMappingError(
        `Connection '${input.connectionId}' does not belong to server '${serverId}'`,
      );
    }

    const mapping = this.mappingRepository.create({
      ...input,
      serverId,
    });

    try {
      const savedMapping = await this.mappingRepository.save(mapping);
      return this.mapMappingEntityToRecord(savedMapping);
    } catch (error) {
      if (
        error instanceof QueryFailedError &&
        (error as { code?: string }).code === '23505'
      ) {
        throw new InvalidMappingError(
          `Mapping already exists for scope '${input.scopeId}' and downstream scope '${input.downstreamScope}'.`,
        );
      }
      throw error;
    }
  }

  async listMappingsByScope(
    scopeId: string,
    serverId: string,
  ): Promise<MappingRecord[]> {
    // Verify scope exists
    await this.assertScopeExists(scopeId, serverId);

    const mappings = await this.mappingRepository.find({
      where: { scopeId, serverId },
      relations: ['connection'],
      order: { downstreamScope: 'ASC' },
    });

    return mappings.map((mapping) => this.mapMappingEntityToRecord(mapping));
  }

  async deleteMapping(mappingId: string): Promise<void> {
    const mapping = await this.mappingRepository.findOne({
      where: { id: mappingId },
    });

    if (!mapping) {
      throw new MappingNotFoundError(mappingId);
    }

    await this.mappingRepository.softDelete(mappingId);
  }

  private async assertServerExists(serverId: string): Promise<void> {
    const exists = await this.serverRepository.exist({
      where: { id: serverId },
    });

    if (!exists) {
      throw new ServerNotFoundError(serverId);
    }
  }

  private async assertScopeExists(id: string, serverId: string): Promise<void> {
    const exists = await this.scopeRepository.exist({
      where: { id, serverId },
    });

    if (!exists) {
      throw new ScopeNotFoundError(id, serverId);
    }
  }

  private async assertHttpServer(serverId: string, message: string): Promise<void> {
    const server = await this.serverRepository.findOne({
      where: { id: serverId },
      select: ['type'],
    });

    if (!server) {
      throw new ServerNotFoundError(serverId);
    }

    if (server.type !== MCP_SERVER_TYPE_HTTP) {
      throw new InvalidServerConfigurationError(message);
    }
  }

  private findDuplicate(values: string[]): string | undefined {
    const seen = new Set<string>();
    for (const value of values) {
      if (seen.has(value)) {
        return value;
      }
      seen.add(value);
    }
    return undefined;
  }

  private mapServerEntityToRecord(server: McpServerEntity): ServerRecord {
    // Note: We intentionally do NOT validate configuration here.
    // Validation happens at create/update time. This mapping is used
    // for read operations and should be tolerant of legacy/invalid data.

    const createdAt =
      server.createdAt instanceof Date
        ? server.createdAt
        : new Date(server.createdAt);
    const updatedAt =
      server.updatedAt instanceof Date
        ? server.updatedAt
        : new Date(server.updatedAt);

    if (server.type === MCP_SERVER_TYPE_HTTP) {
      return {
        id: server.id,
        providedId: server.providedId,
        name: server.name,
        description: server.description,
        type: MCP_SERVER_TYPE_HTTP,
        url: server.url ?? '', // Provide empty string if null to satisfy type
        createdAt,
        updatedAt,
      };
    }

    return {
      id: server.id,
      providedId: server.providedId,
      name: server.name,
      description: server.description,
      type: MCP_SERVER_TYPE_STDIO,
      cmd: server.cmd ?? '', // Provide empty string if null to satisfy type
      args: server.args ?? [],
      createdAt,
      updatedAt,
    };
  }

  private validateServerConfiguration(input: {
    type?: string;
    url?: string;
    cmd?: string;
    args?: string[];
  }): void {
    if (!input.type || !MCP_SERVER_TYPES.includes(input.type as McpServerType)) {
      throw new InvalidServerConfigurationError(
        "Server type must be either 'http' or 'stdio'.",
      );
    }

    if (input.type === MCP_SERVER_TYPE_HTTP) {
      if (!input.url) {
        throw new InvalidServerConfigurationError(
          "HTTP servers must include a URL.",
        );
      }
      if (input.cmd) {
        throw new InvalidServerConfigurationError(
          "HTTP servers cannot include a command.",
        );
      }
      if (input.args && input.args.length > 0) {
        throw new InvalidServerConfigurationError(
          "HTTP servers cannot include command arguments.",
        );
      }
      return;
    }

    if (input.type === MCP_SERVER_TYPE_STDIO) {
      if (!input.cmd) {
        throw new InvalidServerConfigurationError(
          "STDIO servers must include a command.",
        );
      }
      if (input.url) {
        throw new InvalidServerConfigurationError(
          "STDIO servers cannot include a URL.",
        );
      }
      if (input.args && !Array.isArray(input.args)) {
        throw new InvalidServerConfigurationError(
          'STDIO server arguments must be an array of strings.',
        );
      }
    }
  }

  private mapScopeEntityToRecord(scope: McpScopeEntity): ScopeRecord {
    return {
      id: scope.id,
      serverId: scope.serverId,
      description: scope.description,
      createdAt:
        scope.createdAt instanceof Date
          ? scope.createdAt
          : new Date(scope.createdAt),
      updatedAt:
        scope.updatedAt instanceof Date
          ? scope.updatedAt
          : new Date(scope.updatedAt),
    };
  }

  private mapConnectionEntityToRecord(
    connection: McpConnectionEntity,
  ): ConnectionRecord {
    return {
      id: connection.id,
      serverId: connection.serverId,
      friendlyName: connection.friendlyName,
      clientId: connection.clientId,
      clientSecret: connection.clientSecret,
      authorizeUrl: connection.authorizeUrl,
      tokenUrl: connection.tokenUrl,
      createdAt:
        connection.createdAt instanceof Date
          ? connection.createdAt
          : new Date(connection.createdAt),
      updatedAt:
        connection.updatedAt instanceof Date
          ? connection.updatedAt
          : new Date(connection.updatedAt),
    };
  }

  private mapMappingEntityToRecord(
    mapping: McpScopeMappingEntity,
  ): MappingRecord {
    return {
      id: mapping.id,
      scopeId: mapping.scopeId,
      serverId: mapping.serverId,
      connectionId: mapping.connectionId,
      downstreamScope: mapping.downstreamScope,
      createdAt:
        mapping.createdAt instanceof Date
          ? mapping.createdAt
          : new Date(mapping.createdAt),
      updatedAt:
        mapping.updatedAt instanceof Date
          ? mapping.updatedAt
          : new Date(mapping.updatedAt),
    };
  }
}
