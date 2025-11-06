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
  CreateScopeInput,
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
} from './errors/mcp-registry.errors';

@Injectable()
export class McpRegistryService {
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
      scopes: (server.scopes ?? []).map((scope) => this.mapScopeEntityToRecord(scope)),
      connections: (server.connections ?? []).map((connection) =>
        this.mapConnectionEntityToRecord(connection),
      ),
    };
  }

  async getServerByProvidedId(providedId: string): Promise<ServerWithRelationsRecord> {
    const server = await this.serverRepository.findOne({
      where: { providedId },
      relations: ['scopes', 'connections'],
    });

    if (!server) {
      throw new ServerNotFoundError(providedId);
    }

    return {
      ...this.mapServerEntityToRecord(server),
      scopes: (server.scopes ?? []).map((scope) => this.mapScopeEntityToRecord(scope)),
      connections: (server.connections ?? []).map((connection) =>
        this.mapConnectionEntityToRecord(connection),
      ),
    };
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
    inputs: CreateScopeInput[],
  ): Promise<ScopeRecord[]> {
    if (inputs.length === 0) {
      return [];
    }

    await this.assertServerExists(serverId);

    const scopeIds = inputs.map((input) => input.scopeId);
    const duplicateScopeId = this.findDuplicate(scopeIds);

    if (duplicateScopeId) {
      throw new ScopeAlreadyExistsError(duplicateScopeId, serverId);
    }

    const existingScopes = await this.scopeRepository.find({
      where: {
        serverId,
        scopeId: In(scopeIds),
      },
    });

    if (existingScopes.length > 0) {
      throw new ScopeAlreadyExistsError(existingScopes[0].scopeId, serverId);
    }

    const scopeEntities = inputs.map((input) =>
      this.scopeRepository.create({
        ...input,
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
      order: { scopeId: 'ASC' },
    });

    return scopes.map((scope) => this.mapScopeEntityToRecord(scope));
  }

  async getScope(
    scopeId: string,
    serverId: string,
  ): Promise<ScopeWithMappingsRecord> {
    const scope = await this.scopeRepository.findOne({
      where: { scopeId, serverId },
      relations: ['mappings', 'mappings.connection'],
    });

    if (!scope) {
      throw new ScopeNotFoundError(scopeId, serverId);
    }

    return {
      ...this.mapScopeEntityToRecord(scope),
      mappings: (scope.mappings ?? []).map((mapping) =>
        this.mapMappingEntityToRecord(mapping),
      ),
    };
  }

  async deleteScope(scopeId: string, serverId: string): Promise<void> {
    await this.assertScopeExists(scopeId, serverId);

    // Check for mappings
    const mappingCount = await this.mappingRepository.count({
      where: { scopeId, serverId },
    });

    if (mappingCount > 0) {
      throw new ScopeHasMappingsError(scopeId);
    }

    await this.scopeRepository.softDelete({ scopeId, serverId });
  }

  // Connection CRUD operations

  async createConnection(
    serverId: string,
    input: CreateConnectionInput,
  ): Promise<ConnectionRecord> {
    // Verify server exists
    await this.assertServerExists(serverId);

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

  async listConnectionsByServer(
    serverId: string,
  ): Promise<ConnectionRecord[]> {
    // Verify server exists
    await this.assertServerExists(serverId);

    const connections = await this.connectionRepository.find({
      where: { serverId },
      order: { friendlyName: 'ASC' },
    });

    return connections.map((connection) => this.mapConnectionEntityToRecord(connection));
  }

  async getConnection(connectionId: string): Promise<ConnectionWithMappingsRecord> {
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
        where: { serverId: connection.serverId, friendlyName: input.friendlyName },
      });

      if (existing) {
        throw new ConnectionNameConflictError(input.friendlyName, connection.serverId);
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
      if (error instanceof QueryFailedError && (error as { code?: string }).code === '23505') {
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

  private async assertScopeExists(scopeId: string, serverId: string): Promise<void> {
    const exists = await this.scopeRepository.exist({
      where: { scopeId, serverId },
    });

    if (!exists) {
      throw new ScopeNotFoundError(scopeId, serverId);
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
    return {
      id: server.id,
      providedId: server.providedId,
      name: server.name,
      description: server.description,
      createdAt: server.createdAt instanceof Date ? server.createdAt : new Date(server.createdAt),
      updatedAt: server.updatedAt instanceof Date ? server.updatedAt : new Date(server.updatedAt),
    };
  }

  private mapScopeEntityToRecord(scope: McpScopeEntity): ScopeRecord {
    return {
      id: (scope as { id?: string }).id ?? `${scope.serverId}:${scope.scopeId}`,
      scopeId: scope.scopeId,
      serverId: scope.serverId,
      description: scope.description,
      createdAt: scope.createdAt instanceof Date ? scope.createdAt : new Date(scope.createdAt),
      updatedAt: scope.updatedAt instanceof Date ? scope.updatedAt : new Date(scope.updatedAt),
    };
  }

  private mapConnectionEntityToRecord(connection: McpConnectionEntity): ConnectionRecord {
    return {
      id: connection.id,
      serverId: connection.serverId,
      friendlyName: connection.friendlyName,
      clientId: connection.clientId,
      clientSecret: connection.clientSecret,
      authorizeUrl: connection.authorizeUrl,
      tokenUrl: connection.tokenUrl,
      createdAt:
        connection.createdAt instanceof Date ? connection.createdAt : new Date(connection.createdAt),
      updatedAt:
        connection.updatedAt instanceof Date ? connection.updatedAt : new Date(connection.updatedAt),
    };
  }

  private mapMappingEntityToRecord(mapping: McpScopeMappingEntity): MappingRecord {
    return {
      id: mapping.id,
      scopeId: mapping.scopeId,
      serverId: mapping.serverId,
      connectionId: mapping.connectionId,
      downstreamScope: mapping.downstreamScope,
      createdAt:
        mapping.createdAt instanceof Date ? mapping.createdAt : new Date(mapping.createdAt),
      updatedAt:
        mapping.updatedAt instanceof Date ? mapping.updatedAt : new Date(mapping.updatedAt),
    };
  }
}
