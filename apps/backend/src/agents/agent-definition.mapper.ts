import { AgentResult } from './dto/service/agents.service.types';
import {
  AgentDefinition,
  AgentToolPermissionDefinition,
} from './dto/service/agent-import-export.service.types';
import { AgentToolPermissionRecord } from './dto/service/agent-tool-permissions.service.types';

export function toAgentDefinition(
  agent: AgentResult,
  permissions: AgentToolPermissionRecord[],
): AgentDefinition {
  const toolPermissions: AgentToolPermissionDefinition[] = permissions
    .map((permission) => ({
      serverProvidedId: permission.serverProvidedId,
      scopeIds: permission.grantedScopes.map((scope) => scope.id),
    }))
    .sort((left, right) =>
      left.serverProvidedId.localeCompare(right.serverProvidedId),
    );

  return {
    slug: agent.slug,
    name: agent.name,
    type: agent.type,
    description: agent.description,
    introduction: agent.introduction,
    avatarUrl: agent.avatarUrl,
    systemPrompt: agent.systemPrompt,
    followUpPrompt: agent.followUpPrompt,
    providerId: agent.providerId,
    modelId: agent.modelId,
    statusTriggers: agent.statusTriggers,
    tagTriggers: agent.tagTriggers,
    allowedTools: agent.allowedTools,
    isActive: agent.isActive,
    concurrencyLimit: agent.concurrencyLimit,
    toolPermissions,
  };
}
