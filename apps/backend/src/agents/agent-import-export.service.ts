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
import { ResolvedAgentToolGrants } from './dto/service/agent-tool-permissions.service.types';
import { AgentNotFoundError } from './errors/agents.errors';

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

    const definitions: AgentDefinition[] = [];
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
        // Resolved before the agent is touched, so a rejected definition
        // changes nothing and can't leave older, broader grants in place.
        const toolGrants = await this.resolveToolGrants(definition);
        if (toolGrants && toolGrants.invalidScopes.length > 0) {
          result.failed.push({
            slug: definition.slug,
            reason: invalidScopesReason(toolGrants),
          });
          continue;
        }

        const { outcome, actorId } = await this.upsertAgent(definition);
        result[outcome].push(definition.slug);

        if (toolGrants) {
          result.warnings.push(
            ...(await this.applyToolGrants(
              definition.slug,
              actorId,
              toolGrants,
            )),
          );
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

  private async resolveToolGrants(
    definition: AgentDefinition,
  ): Promise<ResolvedAgentToolGrants | undefined> {
    if (definition.toolPermissions === undefined) {
      return undefined;
    }
    return this.agentToolPermissionsService.resolveToolGrants(
      definition.toolPermissions,
    );
  }

  private async upsertAgent(
    definition: AgentDefinition,
  ): Promise<{ outcome: 'created' | 'updated'; actorId: string }> {
    try {
      const existing = await this.agentsService.getAgentBySlug({
        slug: definition.slug,
      });
      await this.agentsService.patchAgent(
        existing.actorId,
        toPatchInput(definition),
      );
      return { outcome: 'updated', actorId: existing.actorId };
    } catch (error) {
      if (!(error instanceof AgentNotFoundError)) {
        throw error;
      }
    }

    const created = await this.agentsService.createAgent(
      toCreateInput(definition),
    );
    return { outcome: 'created', actorId: created.actorId };
  }

  private async applyToolGrants(
    slug: string,
    actorId: string,
    toolGrants: ResolvedAgentToolGrants,
  ): Promise<ImportAgentsResult['warnings']> {
    const warnings = toolGrants.missingServers.map((serverProvidedId) => ({
      slug,
      reason: `Tool grant for MCP server '${serverProvidedId}' was skipped because that server is not in this workspace.`,
    }));

    try {
      await this.agentToolPermissionsService.replaceAgentToolPermissions(
        actorId,
        toolGrants.grants,
      );
    } catch (error) {
      this.logger.warn(
        `Imported agent ${slug} without its tool grants: ${errorMessage(error)}`,
      );
      warnings.push({
        slug,
        reason: `Tool grants were left unchanged: ${errorMessage(error)}`,
      });
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

function invalidScopesReason(toolGrants: ResolvedAgentToolGrants): string {
  const details = toolGrants.invalidScopes.map(
    ({ serverProvidedId, scopeIds }) =>
      `'${serverProvidedId}' does not have ${scopeIds.join(', ')}`,
  );
  return `Agent was not changed because its tool grants use unavailable scopes: ${details.join('; ')}.`;
}

function errorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return 'Failed to import agent.';
}
