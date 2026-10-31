import { Injectable, Logger } from '@nestjs/common';
import { AgentsService } from './agents.service';
import { AgentToolPermissionsService } from './agent-tool-permissions.service';
import { toAgentDefinition } from './agent-definition.mapper';
import {
  AGENT_DEFINITION_VERSION,
  AgentDefinition,
  AgentDefinitionsDocument,
  ImportAgentsResult,
} from './dto/service/agent-import-export.service.types';
import {
  CreateAgentInput,
  PatchAgentInput,
} from './dto/service/agents.service.types';
import {
  AgentNotFoundError,
  InvalidAgentToolPermissionScopeError,
} from './errors/agents.errors';
import { ServerNotFoundError } from '../mcp-registry/errors/mcp-registry.errors';

@Injectable()
export class AgentImportExportService {
  private readonly logger = new Logger(AgentImportExportService.name);

  constructor(
    private readonly agentsService: AgentsService,
    private readonly agentToolPermissionsService: AgentToolPermissionsService,
  ) {}

  async exportAgents(slug?: string): Promise<AgentDefinitionsDocument> {
    const agents = slug
      ? [await this.agentsService.getAgentBySlug({ slug })]
      : await this.agentsService.listAllAgents();

    const definitions = [];
    for (const agent of agents) {
      const permissions =
        await this.agentToolPermissionsService.listStoredAgentToolPermissions(
          agent.actorId,
        );
      definitions.push(toAgentDefinition(agent, permissions));
    }

    return {
      version: AGENT_DEFINITION_VERSION,
      agents: definitions,
    };
  }

  async importAgents(
    document: AgentDefinitionsDocument,
  ): Promise<ImportAgentsResult> {
    const result: ImportAgentsResult = {
      created: [],
      updated: [],
      failed: [],
      warnings: [],
    };
    const seenSlugs = new Set<string>();

    for (const definition of document.agents) {
      if (seenSlugs.has(definition.slug)) {
        result.failed.push({
          slug: definition.slug,
          reason: 'Duplicate slug in import file.',
        });
        continue;
      }
      seenSlugs.add(definition.slug);

      try {
        const outcome = await this.upsertAgent(definition);
        result[outcome].push(definition.slug);
        try {
          const warnings = await this.syncToolPermissions(definition);
          result.warnings.push(...warnings);
        } catch (error) {
          this.logger.warn(
            `Imported agent ${definition.slug} without all tool grants: ${errorMessage(error)}`,
          );
          result.warnings.push({
            slug: definition.slug,
            reason: errorMessage(error),
          });
        }
      } catch (error) {
        this.logger.warn(
          `Failed to import agent ${definition.slug}: ${errorMessage(error)}`,
        );
        result.failed.push({
          slug: definition.slug,
          reason: errorMessage(error),
        });
      }
    }

    return result;
  }

  private async upsertAgent(
    definition: AgentDefinition,
  ): Promise<'created' | 'updated'> {
    try {
      const existing = await this.agentsService.getAgentBySlug({
        slug: definition.slug,
      });
      await this.agentsService.patchAgent(
        existing.actorId,
        toPatchInput(definition),
      );
      return 'updated';
    } catch (error) {
      if (!(error instanceof AgentNotFoundError)) {
        throw error;
      }
    }

    await this.agentsService.createAgent(toCreateInput(definition));
    return 'created';
  }

  private async syncToolPermissions(
    definition: AgentDefinition,
  ): Promise<ImportAgentsResult['warnings']> {
    if (definition.toolPermissions === undefined) {
      return [];
    }

    const agent = await this.agentsService.getAgentBySlug({
      slug: definition.slug,
    });
    const warnings: ImportAgentsResult['warnings'] = [];
    const desiredProvidedIds = new Set<string>();

    for (const grant of definition.toolPermissions) {
      desiredProvidedIds.add(grant.serverProvidedId);
      try {
        await this.agentToolPermissionsService.upsertAgentToolPermissionByProvidedId(
          agent.actorId,
          grant.serverProvidedId,
          { scopeIds: grant.scopeIds },
        );
      } catch (error) {
        if (
          error instanceof ServerNotFoundError ||
          error instanceof InvalidAgentToolPermissionScopeError
        ) {
          warnings.push({
            slug: definition.slug,
            reason: toolGrantWarning(grant.serverProvidedId, error),
          });
          continue;
        }
        throw error;
      }
    }

    const stored =
      await this.agentToolPermissionsService.listStoredAgentToolPermissions(
        agent.actorId,
      );
    for (const permission of stored) {
      if (desiredProvidedIds.has(permission.serverProvidedId)) {
        continue;
      }
      await this.agentToolPermissionsService.deleteAgentToolPermission(
        agent.actorId,
        permission.serverId,
      );
    }

    return warnings;
  }
}

function toCreateInput(definition: AgentDefinition): CreateAgentInput {
  return {
    slug: definition.slug,
    name: definition.name,
    type: definition.type,
    description: definition.description ?? undefined,
    introduction: definition.introduction ?? undefined,
    avatarUrl: definition.avatarUrl,
    systemPrompt: definition.systemPrompt,
    followUpPrompt: definition.followUpPrompt,
    providerId: definition.providerId ?? undefined,
    modelId: definition.modelId ?? undefined,
    statusTriggers: definition.statusTriggers ?? [],
    tagTriggers: definition.tagTriggers ?? [],
    allowedTools: definition.allowedTools ?? [],
    isActive: definition.isActive,
    concurrencyLimit: definition.concurrencyLimit ?? undefined,
  };
}

function toPatchInput(definition: AgentDefinition): PatchAgentInput {
  const input: PatchAgentInput = {};
  if (definition.name !== undefined) {
    input.name = definition.name;
  }
  if (definition.type !== undefined) {
    input.type = definition.type;
  }
  if (definition.description !== undefined) {
    input.description = definition.description;
  }
  if (definition.introduction !== undefined) {
    input.introduction = definition.introduction;
  }
  if (definition.avatarUrl !== undefined) {
    input.avatarUrl = definition.avatarUrl;
  }
  if (definition.systemPrompt !== undefined) {
    input.systemPrompt = definition.systemPrompt;
  }
  if (definition.followUpPrompt !== undefined) {
    input.followUpPrompt = definition.followUpPrompt;
  }
  if (definition.providerId !== undefined) {
    input.providerId = definition.providerId ?? '';
  }
  if (definition.modelId !== undefined) {
    input.modelId = definition.modelId ?? '';
  }
  if (definition.statusTriggers !== undefined) {
    input.statusTriggers = definition.statusTriggers;
  }
  if (definition.tagTriggers !== undefined) {
    input.tagTriggers = definition.tagTriggers;
  }
  if (definition.allowedTools !== undefined) {
    input.allowedTools = definition.allowedTools;
  }
  if (definition.isActive !== undefined) {
    input.isActive = definition.isActive;
  }
  if (definition.concurrencyLimit !== undefined) {
    input.concurrencyLimit = definition.concurrencyLimit;
  }
  return input;
}

function toolGrantWarning(serverProvidedId: string, error: Error): string {
  if (error instanceof ServerNotFoundError) {
    return `Tool grant for MCP server '${serverProvidedId}' was skipped because that server is not in this workspace.`;
  }
  return `Tool grant for MCP server '${serverProvidedId}' was skipped: ${error.message}`;
}

function errorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return 'Failed to import agent.';
}
