import { test } from 'node:test';
import assert from 'node:assert/strict';
import type {
  AgentToolPermissionResponseDto,
  ServerResponseDto,
} from '@taico/client/v2';
import { buildRuntimeMcpServers } from '../helpers/runtimeMcpServers.js';
import { EXECUTION_ID_HEADER } from '../helpers/config.js';

const credentials = { executionId: 'exec-1', accessToken: 'taico-token' };

function server(
  id: string,
  overrides: Partial<ServerResponseDto> = {},
): ServerResponseDto {
  return {
    id,
    providedId: id,
    name: id,
    description: id,
    type: 'http',
    authType: 'taico',
    requiresTaicoAuth: false,
    url: `https://${id}.example.com/mcp`,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    ...overrides,
  } as ServerResponseDto;
}

function permissionsFor(
  servers: ServerResponseDto[],
): AgentToolPermissionResponseDto[] {
  return servers.map(
    (s) =>
      ({
        server: { id: s.id, providedId: s.providedId },
      }) as AgentToolPermissionResponseDto,
  );
}

function build(servers: ServerResponseDto[]) {
  return buildRuntimeMcpServers(
    permissionsFor(servers),
    new Map(servers.map((s) => [s.id, s])),
    credentials,
  );
}

test('Taico-auth HTTP servers get the Taico token and execution ID', () => {
  const runtime = build([server('tasks')]);
  const tasks = runtime.tasks;
  assert.equal(tasks.type, 'http');
  assert.deepEqual(tasks.type === 'http' && tasks.headers, {
    Authorization: 'Bearer taico-token',
    [EXECUTION_ID_HEADER]: 'exec-1',
  });
});

test("Taico's own servers keep their credentials next to external servers", () => {
  // The registry locks tasks and context to Taico auth (requiresTaicoAuth),
  // so a run that also uses an external server must still authenticate them.
  const runtime = build([
    server('tasks', { requiresTaicoAuth: true }),
    server('context', { requiresTaicoAuth: true }),
    server('github', { authType: 'external' }),
  ]);
  for (const id of ['tasks', 'context']) {
    const entry = runtime[id];
    assert.deepEqual(entry.type === 'http' && entry.headers, {
      Authorization: 'Bearer taico-token',
      [EXECUTION_ID_HEADER]: 'exec-1',
    });
  }
  const github = runtime.github;
  assert.deepEqual(github.type === 'http' && github.headers, {});
});

test('external HTTP servers get neither header', () => {
  const runtime = build([server('github', { authType: 'external' })]);
  const github = runtime.github;
  assert.equal(github.type, 'http');
  assert.deepEqual(github.type === 'http' && github.headers, {});
});

test('auth type comes from the registry, not the URL', () => {
  // An external server hosted on the same origin as Taico still gets nothing.
  const runtime = build([
    server('lookalike', {
      authType: 'external',
      url: 'http://localhost:3000/api/v1/tasks/tasks/mcp',
    }),
  ]);
  const lookalike = runtime.lookalike;
  assert.deepEqual(lookalike.type === 'http' && lookalike.headers, {});
});

test('a server without an auth type (older backend) is treated as Taico auth', () => {
  const legacy = server('legacy');
  delete (legacy as { authType?: string }).authType;
  const runtime = build([legacy]);
  const entry = runtime.legacy;
  assert.equal(
    entry.type === 'http' && entry.headers.Authorization,
    'Bearer taico-token',
  );
});

test('mixed servers keep their tools and stdio servers get no headers', () => {
  const runtime = build([
    server('tasks'),
    server('github', { authType: 'external' }),
    server('playwright', {
      type: 'stdio',
      url: undefined,
      cmd: 'npx',
      args: ['@playwright/mcp@latest'],
    }),
  ]);
  assert.deepEqual(Object.keys(runtime).sort(), ['github', 'playwright', 'tasks']);
  assert.deepEqual(runtime.playwright, {
    type: 'stdio',
    command: 'npx',
    args: ['@playwright/mcp@latest'],
  });
  assert.ok(!JSON.stringify(runtime.github).includes('taico-token'));
});
