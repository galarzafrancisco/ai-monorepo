import { AgentType } from './enums';
import { TaskStatus } from 'src/tasks/enums';
import { toAgentDefinition } from './agent-definition.mapper';
import { AgentResult } from './dto/service/agents.service.types';
import { AgentToolPermissionRecord } from './dto/service/agent-tool-permissions.service.types';

const FORBIDDEN_KEYS = [
  'id',
  'actorId',
  'rowVersion',
  'createdAt',
  'updatedAt',
  'deletedAt',
  'token',
  'accessToken',
  'refreshToken',
  'clientSecret',
  'clientId',
  'serverId',
];

function agent(): AgentResult {
  return {
    actorId: 'actor-secret',
    slug: 'buddy',
    name: 'Buddy',
    type: AgentType.CLAUDE,
    description: 'Helps',
    introduction: 'Reviews code',
    avatarUrl: '/avatar/claude.webp',
    systemPrompt: 'Be useful',
    followUpPrompt: 'Did you finish?',
    providerId: 'anthropic',
    modelId: 'claude-sonnet',
    statusTriggers: [TaskStatus.NOT_STARTED],
    tagTriggers: ['code'],
    allowedTools: ['tasks.readTask'],
    isActive: true,
    concurrencyLimit: 2,
    rowVersion: 7,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-02T00:00:00.000Z'),
    deletedAt: null,
  };
}

function permission(): AgentToolPermissionRecord {
  return {
    serverId: 'server-uuid',
    serverProvidedId: 'tasks',
    serverName: 'Tasks',
    serverDescription: 'Task tools',
    serverType: 'http',
    grantedScopes: [{ id: 'tasks:read', description: 'Read tasks' }],
    hasAllScopes: false,
  };
}

describe('toAgentDefinition', () => {
  it('keeps portable configuration and drops ids, timestamps, and secrets', () => {
    const definition = toAgentDefinition(agent(), [permission()]);

    expect(definition).toEqual({
      slug: 'buddy',
      name: 'Buddy',
      type: AgentType.CLAUDE,
      description: 'Helps',
      introduction: 'Reviews code',
      avatarUrl: '/avatar/claude.webp',
      systemPrompt: 'Be useful',
      followUpPrompt: 'Did you finish?',
      providerId: 'anthropic',
      modelId: 'claude-sonnet',
      statusTriggers: [TaskStatus.NOT_STARTED],
      tagTriggers: ['code'],
      allowedTools: ['tasks.readTask'],
      isActive: true,
      concurrencyLimit: 2,
      toolPermissions: [
        { serverProvidedId: 'tasks', scopeIds: ['tasks:read'] },
      ],
    });

    const serialized = JSON.stringify(definition);
    for (const key of FORBIDDEN_KEYS) {
      expect(definition).not.toHaveProperty(key);
      expect(serialized).not.toContain(`"${key}"`);
    }
    expect(serialized).not.toContain('actor-secret');
    expect(serialized).not.toContain('server-uuid');
  });
});
