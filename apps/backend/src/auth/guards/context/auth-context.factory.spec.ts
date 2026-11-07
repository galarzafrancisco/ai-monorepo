import { ExecutionContext } from '@nestjs/common';
import { ActorType } from 'src/identity-provider/enums';
import { DEFAULT_WORKSPACE_ID } from '../../../workspaces/workspaces.constants';
import { AccessTokenClaims } from '../../core/types/access-token-claims.type';
import { currentWorkspaceId } from '../decorators/current-workspace.decorator';
import { createAuthContext } from './auth-context.factory';

const OTHER_WORKSPACE_ID = '11111111-1111-4111-8111-111111111111';

function claims(overrides: Partial<AccessTokenClaims> = {}): AccessTokenClaims {
  return {
    iss: 'http://localhost',
    sub: 'actor-1',
    actor_id: 'actor-1',
    actor_slug: 'someone',
    actor_type: ActorType.HUMAN,
    aud: 'http://localhost',
    exp: 0,
    iat: 0,
    jti: 'jti',
    client_id: 'web-app',
    scope: ['tasks:read'],
    resource: 'http://localhost',
    version: '0.0.0',
    ...overrides,
  };
}

function httpContext(auth: unknown): ExecutionContext {
  return {
    getType: () => 'http',
    switchToHttp: () => ({ getResponse: () => ({ locals: { auth } }) }),
  } as unknown as ExecutionContext;
}

function wsContext(auth: unknown): ExecutionContext {
  return {
    getType: () => 'ws',
    switchToWs: () => ({ getClient: () => ({ data: { auth } }) }),
  } as unknown as ExecutionContext;
}

describe('createAuthContext', () => {
  it('takes the workspace from the workspace_id claim', () => {
    const auth = createAuthContext('t', claims({ workspace_id: OTHER_WORKSPACE_ID }));
    expect(auth.workspaceId).toBe(OTHER_WORKSPACE_ID);
    expect(auth.scopes).toEqual(['tasks:read']);
    expect(auth.subject).toBe('actor-1');
  });

  it('falls back to the default workspace when the claim is missing', () => {
    expect(createAuthContext('t', claims()).workspaceId).toBe(DEFAULT_WORKSPACE_ID);
  });
});

describe('@CurrentWorkspace()', () => {
  const auth = createAuthContext('t', claims({ workspace_id: OTHER_WORKSPACE_ID }));

  it('reads the workspace of an HTTP request', () => {
    expect(currentWorkspaceId(httpContext(auth))).toBe(OTHER_WORKSPACE_ID);
  });

  it('reads the workspace of a WebSocket connection', () => {
    expect(currentWorkspaceId(wsContext(auth))).toBe(OTHER_WORKSPACE_ID);
  });

  it('refuses a request the auth guard did not run on', () => {
    expect(() => currentWorkspaceId(httpContext(undefined))).toThrow();
    expect(() => currentWorkspaceId(wsContext(undefined))).toThrow();
  });
});
