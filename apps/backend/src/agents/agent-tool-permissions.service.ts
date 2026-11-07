import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, In, Repository } from 'typeorm';
import { AgentEntity } from './agent.entity';
import { AgentNotFoundError } from './errors/agents.errors';
import { McpServerEntity } from '../mcp-registry/entities/mcp-server.entity';
import { ServerNotFoundError } from '../mcp-registry/errors/mcp-registry.errors';
import { AgentToolPermissionEntity } from './agent-tool-permission.entity';
import { AgentToolPermissionScopeEntity } from './agent-tool-permission-scope.entity';
import {
  AgentToolPermissionRecord,
  AgentToolPermissionScopeRecord,
  ResolvedAgentToolGrant,
  ResolvedAgentToolGrants,
  UpsertAgentToolPermissionInput,
} from './dto/service/agent-tool-permissions.service.types';
import {
  AgentToolPermissionNotFoundError,
  InvalidAgentToolPermissionScopeError,
} from './errors/agents.errors';
import { BASELINE_SYSTEM_TOOL_PROVIDED_IDS } from '@taico/shared';
import { holdsUnscopedModuleData } from '../workspaces/unscoped-modules';

/**
 * An agent's grants are in the agent's workspace. They point at MCP registry
 * servers, which are default-workspace rows until phase 3e, so only the
 * default workspace can grant them; other workspaces' agents get Taico's own
 * baseline tools only.
 */
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

  async listAgentToolPermissions(
    workspaceId: string,
    actorId: string,
  ): Promise<AgentToolPermissionRecord[]> {
    await this.assertAgentExists(workspaceId, actorId);

    const permissions = await this.permissionRepository.find({
      where: { workspaceId, agentActorId: actorId },
      relations: ['server', 'server.scopes', 'grantedScopes', 'grantedScopes.scope'],
      order: {
        server: { name: 'ASC' },
      },
    });

    const explicitPermissions = permissions
      .filter(
        (permission): permission is AgentToolPermissionEntity & {
          server: McpServerEntity;
        } => Boolean(permission.server),
      )
      .map((permission) => this.mapPermissionToRecord(permission));

    const permissionsByProvidedId = new Map(
      explicitPermissions.map((permission) => [permission.serverProvidedId, permission]),
    );

    const baselineServers = await this.serverRepository.find({
      where: {
        providedId: In([...BASELINE_SYSTEM_TOOL_PROVIDED_IDS]),
      },
      relations: ['scopes'],
    });

    for (const baselineServer of baselineServers) {
      permissionsByProvidedId.set(
        baselineServer.providedId,
        this.mapBaselineServerToRecord(baselineServer),
      );
    }

    return [...permissionsByProvidedId.values()].sort((a, b) =>
      a.serverName.localeCompare(b.serverName),
    );
  }

  async listStoredAgentToolPermissions(
    workspaceId: string,
    actorId: string,
  ): Promise<AgentToolPermissionRecord[]> {
    await this.assertAgentExists(workspaceId, actorId);

    const permissions = await this.permissionRepository.find({
      where: { workspaceId, agentActorId: actorId },
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

  /**
   * Checks grants addressed by server provided id against this workspace.
   * Read-only, so callers can reject a definition before changing anything.
   */
  async resolveToolGrants(
    workspaceId: string,
    grants: { serverProvidedId: string; scopeIds: string[] }[],
  ): Promise<ResolvedAgentToolGrants> {
    if (!holdsUnscopedModuleData(workspaceId)) {
      return {
        grants: [],
        missingServers: grants.map((grant) => grant.serverProvidedId),
        invalidScopes: [],
      };
    }
    const servers = await this.serverRepository.find({
      where: { providedId: In(grants.map((grant) => grant.serverProvidedId)) },
      relations: ['scopes'],
    });
    const serverByProvidedId = new Map(
      servers.map((server) => [server.providedId, server]),
    );

    const resolved = new Map<string, ResolvedAgentToolGrant>();
    const missingServers: string[] = [];
    const invalidScopes: ResolvedAgentToolGrants['invalidScopes'] = [];

    for (const grant of grants) {
      const server = serverByProvidedId.get(grant.serverProvidedId);
      if (!server) {
        missingServers.push(grant.serverProvidedId);
        continue;
      }

      const scopeIds = Array.from(new Set(grant.scopeIds));
      const available = new Set((server.scopes ?? []).map((scope) => scope.id));
      const unavailable = scopeIds.filter((scopeId) => !available.has(scopeId));
      if (unavailable.length > 0) {
        invalidScopes.push({
          serverProvidedId: grant.serverProvidedId,
          scopeIds: unavailable,
        });
        continue;
      }

      resolved.set(server.id, { serverId: server.id, scopeIds });
    }

    return { grants: [...resolved.values()], missingServers, invalidScopes };
  }

  /**
   * Makes `grants` the agent's complete set of stored tool grants. Either all
   * of it applies or the agent keeps the grants it had.
   */
  async replaceAgentToolPermissions(
    workspaceId: string,
    actorId: string,
    grants: ResolvedAgentToolGrant[],
  ): Promise<void> {
    await this.assertAgentExists(workspaceId, actorId);

    await this.permissionRepository.manager.transaction(async (manager) => {
      await manager
        .getRepository(AgentToolPermissionEntity)
        .delete({ workspaceId, agentActorId: actorId });

      for (const grant of grants) {
        await this.writePermission(manager, workspaceId, actorId, grant);
      }
    });
  }

  async upsertAgentToolPermission(
    workspaceId: string,
    actorId: string,
    serverId: string,
    input: UpsertAgentToolPermissionInput,
  ): Promise<AgentToolPermissionRecord> {
    await this.assertAgentExists(workspaceId, actorId);

    const server = holdsUnscopedModuleData(workspaceId)
      ? await this.serverRepository.findOne({
          where: { id: serverId },
          relations: ['scopes'],
        })
      : null;
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

    await this.permissionRepository.manager.transaction((manager) =>
      this.writePermission(manager, workspaceId, actorId, {
        serverId,
        scopeIds: normalizedScopeIds,
      }),
    );

    return {
      serverId: server.id,
      serverProvidedId: server.providedId,
      serverName: server.name,
      serverDescription: server.description,
      serverType: server.type,
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

  async deleteAgentToolPermission(
    workspaceId: string,
    actorId: string,
    serverId: string,
  ): Promise<void> {
    await this.assertAgentExists(workspaceId, actorId);

    const result = await this.permissionRepository.delete({
      workspaceId,
      agentActorId: actorId,
      serverId,
    });

    if (!result.affected) {
      throw new AgentToolPermissionNotFoundError(actorId, serverId);
    }
  }

  private async writePermission(
    manager: EntityManager,
    workspaceId: string,
    actorId: string,
    { serverId, scopeIds }: ResolvedAgentToolGrant,
  ): Promise<void> {
    const permissionRepo = manager.getRepository(AgentToolPermissionEntity);
    const permissionScopeRepo = manager.getRepository(AgentToolPermissionScopeEntity);

    await permissionRepo.save(
      permissionRepo.create({
        workspaceId,
        agentActorId: actorId,
        serverId,
      }),
    );

    await permissionScopeRepo.delete({
      agentActorId: actorId,
      serverId,
    });

    if (scopeIds.length === 0) {
      return;
    }

    await permissionScopeRepo.save(
      scopeIds.map((scopeId) =>
        permissionScopeRepo.create({
          workspaceId,
          agentActorId: actorId,
          serverId,
          scopeId,
        }),
      ),
    );
  }

  private async assertAgentExists(
    workspaceId: string,
    actorId: string,
  ): Promise<void> {
    const exists = await this.agentRepository.exist({
      where: { workspaceId, actorId },
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
      grantedScopes,
      hasAllScopes:
        availableScopes.length > 0 && grantedScopes.length === availableScopes.length,
    };
  }

  private mapBaselineServerToRecord(server: McpServerEntity): AgentToolPermissionRecord {
    const availableScopes: AgentToolPermissionScopeRecord[] = (server.scopes ?? [])
      .map((scope) => ({
        id: scope.id,
        description: scope.description,
      }))
      .sort((a, b) => a.id.localeCompare(b.id));

    return {
      serverId: server.id,
      serverProvidedId: server.providedId,
      serverName: server.name,
      serverDescription: server.description,
      serverType: server.type,
      grantedScopes: availableScopes,
      hasAllScopes: true,
    };
  }
}
