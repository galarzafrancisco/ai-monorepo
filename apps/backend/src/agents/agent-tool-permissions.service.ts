import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AgentEntity } from './agent.entity';
import { AgentNotFoundError } from './errors/agents.errors';
import { McpServerEntity } from '../mcp-registry/entities/mcp-server.entity';
import { ServerNotFoundError } from '../mcp-registry/errors/mcp-registry.errors';
import { AgentToolPermissionEntity } from './agent-tool-permission.entity';
import { AgentToolPermissionScopeEntity } from './agent-tool-permission-scope.entity';
import {
  AgentToolPermissionRecord,
  AgentToolPermissionScopeRecord,
  UpsertAgentToolPermissionInput,
} from './dto/service/agent-tool-permissions.service.types';
import {
  AgentToolPermissionNotFoundError,
  InvalidAgentToolPermissionScopeError,
} from './errors/agents.errors';

@Injectable()
export class AgentToolPermissionsService {
  constructor(
    @InjectRepository(AgentEntity)
    private readonly agentRepository: Repository<AgentEntity>,
    @InjectRepository(McpServerEntity)
    private readonly serverRepository: Repository<McpServerEntity>,
    @InjectRepository(AgentToolPermissionEntity)
    private readonly permissionRepository: Repository<AgentToolPermissionEntity>,
    @InjectRepository(AgentToolPermissionScopeEntity)
    private readonly permissionScopeRepository: Repository<AgentToolPermissionScopeEntity>,
  ) {}

  async listAgentToolPermissions(actorId: string): Promise<AgentToolPermissionRecord[]> {
    await this.assertAgentExists(actorId);

    const permissions = await this.permissionRepository.find({
      where: { agentActorId: actorId },
      relations: ['server', 'server.scopes', 'grantedScopes', 'grantedScopes.scope'],
      order: {
        server: { name: 'ASC' },
      },
    });

    return permissions
      .filter(
        (permission): permission is AgentToolPermissionEntity & {
          server: McpServerEntity;
        } => Boolean(permission.server),
      )
      .map((permission) => this.mapPermissionToRecord(permission));
  }

  async upsertAgentToolPermission(
    actorId: string,
    serverId: string,
    input: UpsertAgentToolPermissionInput,
  ): Promise<AgentToolPermissionRecord> {
    await this.assertAgentExists(actorId);

    const server = await this.serverRepository.findOne({
      where: { id: serverId },
      relations: ['scopes'],
    });
    if (!server) {
      throw new ServerNotFoundError(serverId);
    }

    const normalizedScopeIds = Array.from(new Set(input.scopeIds ?? []));
    const availableScopes = server.scopes ?? [];
    const scopeById = new Map(availableScopes.map((scope) => [scope.id, scope]));
    const invalidScopeIds = normalizedScopeIds.filter((scopeId) => !scopeById.has(scopeId));
    if (invalidScopeIds.length > 0) {
      throw new InvalidAgentToolPermissionScopeError(serverId, invalidScopeIds);
    }

    await this.permissionRepository.manager.transaction(async (manager) => {
      const permissionRepo = manager.getRepository(AgentToolPermissionEntity);
      const permissionScopeRepo = manager.getRepository(AgentToolPermissionScopeEntity);

      await permissionRepo.save(
        permissionRepo.create({
          agentActorId: actorId,
          serverId,
        }),
      );

      await permissionScopeRepo.delete({
        agentActorId: actorId,
        serverId,
      });

      if (normalizedScopeIds.length === 0) {
        return;
      }

      const grantedScopeRows = normalizedScopeIds.map((scopeId) =>
        permissionScopeRepo.create({
          agentActorId: actorId,
          serverId,
          scopeId,
        }),
      );
      await permissionScopeRepo.save(grantedScopeRows);
    });

    return {
      serverId: server.id,
      serverProvidedId: server.providedId,
      serverName: server.name,
      serverDescription: server.description,
      serverType: server.type,
      availableScopes: availableScopes.map((scope) => ({
        id: scope.id,
        description: scope.description,
      })),
      grantedScopes: normalizedScopeIds.map((scopeId) => {
        const scope = scopeById.get(scopeId);
        return {
          id: scopeId,
          description: scope?.description ?? '',
        };
      }),
      hasAllScopes:
        availableScopes.length > 0 && normalizedScopeIds.length === availableScopes.length,
    };
  }

  async deleteAgentToolPermission(actorId: string, serverId: string): Promise<void> {
    await this.assertAgentExists(actorId);

    const result = await this.permissionRepository.delete({
      agentActorId: actorId,
      serverId,
    });

    if (!result.affected) {
      throw new AgentToolPermissionNotFoundError(actorId, serverId);
    }
  }

  private async assertAgentExists(actorId: string): Promise<void> {
    const exists = await this.agentRepository.exist({
      where: { actorId },
    });
    if (!exists) {
      throw new AgentNotFoundError(actorId);
    }
  }

  private mapPermissionToRecord(
    permission: AgentToolPermissionEntity,
  ): AgentToolPermissionRecord {
    const availableScopes: AgentToolPermissionScopeRecord[] = (
      permission.server?.scopes ?? []
    )
      .map((scope) => ({
        id: scope.id,
        description: scope.description,
      }))
      .sort((a, b) => a.id.localeCompare(b.id));

    const availableScopeById = new Map(availableScopes.map((scope) => [scope.id, scope]));
    const grantedScopes: AgentToolPermissionScopeRecord[] = (
      permission.grantedScopes ?? []
    )
      .map((permissionScope) => {
        const fromAvailable = availableScopeById.get(permissionScope.scopeId);
        if (fromAvailable) {
          return fromAvailable;
        }

        const scopedDescription = permissionScope.scope?.description;
        return {
          id: permissionScope.scopeId,
          description: scopedDescription ?? '',
        };
      })
      .sort((a, b) => a.id.localeCompare(b.id));

    return {
      serverId: permission.serverId,
      serverProvidedId: permission.server.providedId,
      serverName: permission.server.name,
      serverDescription: permission.server.description,
      serverType: permission.server.type,
      availableScopes,
      grantedScopes,
      hasAllScopes:
        availableScopes.length > 0 && grantedScopes.length === availableScopes.length,
    };
  }
}
