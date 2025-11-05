import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  McpServerEntity,
  McpScopeEntity,
  McpConnectionEntity,
  McpScopeMappingEntity,
} from './entities';
import {
  CreateServerDto,
  CreateScopeDto,
  CreateConnectionDto,
  CreateMappingDto,
} from './dto';
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

  async createServer(dto: CreateServerDto): Promise<McpServerEntity> {
    // Check for duplicate providedId
    const existing = await this.serverRepository.findOne({
      where: { providedId: dto.providedId },
    });

    if (existing) {
      throw new ServerAlreadyExistsError(dto.providedId);
    }

    const server = this.serverRepository.create(dto);
    return this.serverRepository.save(server);
  }

  async listServers(
    page: number = 1,
    limit: number = 50,
  ): Promise<{ items: McpServerEntity[]; total: number; page: number; limit: number }> {
    const [items, total] = await this.serverRepository.findAndCount({
      skip: (page - 1) * limit,
      take: limit,
      order: { createdAt: 'DESC' },
      relations: ['scopes', 'connections'],
    });

    return { items, total, page, limit };
  }

  async getServerById(id: string): Promise<McpServerEntity> {
    const server = await this.serverRepository.findOne({
      where: { id },
      relations: ['scopes', 'connections'],
    });

    if (!server) {
      throw new ServerNotFoundError(id);
    }

    return server;
  }

  async getServerByProvidedId(providedId: string): Promise<McpServerEntity> {
    const server = await this.serverRepository.findOne({
      where: { providedId },
      relations: ['scopes', 'connections'],
    });

    if (!server) {
      throw new ServerNotFoundError(providedId);
    }

    return server;
  }

  async deleteServer(id: string): Promise<void> {
    const server = await this.getServerById(id);

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

  async createScope(
    serverId: string,
    dto: CreateScopeDto,
  ): Promise<McpScopeEntity> {
    // Verify server exists
    await this.getServerById(serverId);

    // Check for duplicate scope
    const existing = await this.scopeRepository.findOne({
      where: { scopeId: dto.scopeId, serverId },
    });

    if (existing) {
      throw new ScopeAlreadyExistsError(dto.scopeId, serverId);
    }

    const scope = this.scopeRepository.create({
      ...dto,
      serverId,
    });

    return this.scopeRepository.save(scope);
  }

  async createScopes(
    serverId: string,
    dtos: CreateScopeDto[],
  ): Promise<McpScopeEntity[]> {
    const scopes: McpScopeEntity[] = [];

    for (const dto of dtos) {
      const scope = await this.createScope(serverId, dto);
      scopes.push(scope);
    }

    return scopes;
  }

  async listScopesByServer(serverId: string): Promise<McpScopeEntity[]> {
    // Verify server exists
    await this.getServerById(serverId);

    return this.scopeRepository.find({
      where: { serverId },
      relations: ['mappings'],
      order: { scopeId: 'ASC' },
    });
  }

  async getScope(
    scopeId: string,
    serverId: string,
  ): Promise<McpScopeEntity> {
    const scope = await this.scopeRepository.findOne({
      where: { scopeId, serverId },
      relations: ['mappings', 'mappings.connection'],
    });

    if (!scope) {
      throw new ScopeNotFoundError(scopeId, serverId);
    }

    return scope;
  }

  async deleteScope(scopeId: string, serverId: string): Promise<void> {
    const scope = await this.getScope(scopeId, serverId);

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
    dto: CreateConnectionDto,
  ): Promise<McpConnectionEntity> {
    // Verify server exists
    await this.getServerById(serverId);

    // Check for duplicate friendly name per server
    const existing = await this.connectionRepository.findOne({
      where: { serverId, friendlyName: dto.friendlyName },
    });

    if (existing) {
      throw new ConnectionNameConflictError(dto.friendlyName, serverId);
    }

    const connection = this.connectionRepository.create({
      ...dto,
      serverId,
    });

    return this.connectionRepository.save(connection);
  }

  async listConnectionsByServer(
    serverId: string,
  ): Promise<McpConnectionEntity[]> {
    // Verify server exists
    await this.getServerById(serverId);

    return this.connectionRepository.find({
      where: { serverId },
      relations: ['mappings'],
      order: { friendlyName: 'ASC' },
    });
  }

  async getConnection(connectionId: string): Promise<McpConnectionEntity> {
    const connection = await this.connectionRepository.findOne({
      where: { id: connectionId },
      relations: ['server', 'mappings'],
    });

    if (!connection) {
      throw new ConnectionNotFoundError(connectionId);
    }

    return connection;
  }

  async deleteConnection(connectionId: string): Promise<void> {
    const connection = await this.getConnection(connectionId);

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
    dto: CreateMappingDto,
  ): Promise<McpScopeMappingEntity> {
    // Verify scope exists
    await this.getScope(dto.scopeId, serverId);

    // Verify connection exists and belongs to the same server
    const connection = await this.getConnection(dto.connectionId);

    if (connection.serverId !== serverId) {
      throw new InvalidMappingError(
        `Connection '${dto.connectionId}' does not belong to server '${serverId}'`,
      );
    }

    const mapping = this.mappingRepository.create({
      ...dto,
      serverId,
    });

    return this.mappingRepository.save(mapping);
  }

  async listMappingsByScope(
    scopeId: string,
    serverId: string,
  ): Promise<McpScopeMappingEntity[]> {
    // Verify scope exists
    await this.getScope(scopeId, serverId);

    return this.mappingRepository.find({
      where: { scopeId, serverId },
      relations: ['connection'],
      order: { downstreamScope: 'ASC' },
    });
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
}
