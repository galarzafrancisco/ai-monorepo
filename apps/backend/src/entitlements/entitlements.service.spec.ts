import { WorkspaceRole } from 'src/workspaces/enums';
import { NoWorkspaceMembershipError } from 'src/workspaces/workspace.errors';
import { WorkspacesService } from 'src/workspaces/workspaces.service';
import {
  TokenActorNotInWorkspaceError,
  TokenScopeNotEntitledError,
} from './entitlements.errors';
import { WORKSPACE_ADMIN_SCOPE_IDS } from './entitlements.scopes';
import { EntitlementsService } from './entitlements.service';

const WS_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const WS_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

/** Memberships as `actorId -> workspaceId -> role`; the first listed is the oldest. */
function serviceWith(memberships: Record<string, Record<string, WorkspaceRole>>) {
  const workspaces = {
    findRole: jest.fn(async (workspaceId: string, actorId: string) =>
      memberships[actorId]?.[workspaceId] ?? null,
    ),
    findMembershipForActor: jest.fn(async (actorId: string) => {
      const [workspaceId, role] = Object.entries(memberships[actorId] ?? {})[0] ?? [];
      return workspaceId ? { workspaceId, role } : null;
    }),
  } as unknown as WorkspacesService;
  return new EntitlementsService(workspaces);
}

describe('EntitlementsService', () => {
  const service = serviceWith({
    admin: { [WS_A]: WorkspaceRole.ADMIN, [WS_B]: WorkspaceRole.MEMBER },
    member: { [WS_A]: WorkspaceRole.MEMBER },
    agent: { [WS_A]: WorkspaceRole.MEMBER },
    nobody: {},
  });

  describe('sessionEntitlement', () => {
    it('keeps the preferred workspace while still a member, else the oldest', async () => {
      await expect(service.sessionEntitlement('admin', WS_B)).resolves.toEqual({
        workspaceId: WS_B,
        role: WorkspaceRole.MEMBER,
      });
      await expect(service.sessionEntitlement('member', WS_B)).resolves.toEqual({
        workspaceId: WS_A,
        role: WorkspaceRole.MEMBER,
      });
    });

    it('refuses someone in no workspace', async () => {
      await expect(service.sessionEntitlement('nobody', null)).rejects.toBeInstanceOf(
        NoWorkspaceMembershipError,
      );
    });
  });

  describe('webSessionScopes', () => {
    it('gives workspace-admin scopes by role and installation scopes by operator', () => {
      const member = service.webSessionScopes(
        { workspaceId: WS_A, role: WorkspaceRole.MEMBER },
        { operator: true },
      );
      expect(member).toContain('installation:admin');
      expect(member).toContain('user:standard');
      for (const scope of WORKSPACE_ADMIN_SCOPE_IDS) expect(member).not.toContain(scope);

      const admin = service.webSessionScopes(
        { workspaceId: WS_A, role: WorkspaceRole.ADMIN },
        { operator: false },
      );
      expect(admin).not.toContain('installation:admin');
      expect(admin).not.toContain('user:standard');
      for (const scope of WORKSPACE_ADMIN_SCOPE_IDS) expect(admin).toContain(scope);
      for (const tokens of [member, admin]) {
        expect(tokens).not.toContain('workers:connect');
        expect(tokens).not.toContain('run:impersonate');
      }
    });
  });

  describe('mcpTokenEntitlement', () => {
    const taicoServer = { providedId: 'tasks', workspaceId: WS_A };
    const registryServer = { providedId: 'github-mcp', workspaceId: WS_B };

    it("uses the consent workspace for Taico's own servers, and refuses once removed", async () => {
      await expect(service.mcpTokenEntitlement(taicoServer, 'admin', WS_B)).resolves.toEqual({
        workspaceId: WS_B,
        role: WorkspaceRole.MEMBER,
      });
      await expect(
        service.mcpTokenEntitlement(taicoServer, 'member', WS_B),
      ).rejects.toBeInstanceOf(TokenActorNotInWorkspaceError);
    });

    it('falls back to the oldest membership for journeys without a consent workspace', async () => {
      await expect(service.mcpTokenEntitlement(taicoServer, 'admin', null)).resolves.toEqual({
        workspaceId: WS_A,
        role: WorkspaceRole.ADMIN,
      });
    });

    it("uses a registry server's own workspace", async () => {
      await expect(service.mcpTokenEntitlement(registryServer, 'admin', WS_A)).resolves.toEqual({
        workspaceId: WS_B,
        role: WorkspaceRole.MEMBER,
      });
      await expect(
        service.mcpTokenEntitlement(registryServer, 'member', WS_A),
      ).rejects.toBeInstanceOf(TokenActorNotInWorkspaceError);
    });
  });

  describe('mcpTokenScopes', () => {
    const authorized = ['tasks:read', 'mcp-registry:write', 'installation:admin', 'workers:connect', 'repo'];

    it("drops admin scopes for members and installation scopes for anyone, keeping client and registry scopes", () => {
      expect(service.mcpTokenScopes(authorized, WorkspaceRole.MEMBER)).toEqual([
        'tasks:read',
        'workers:connect',
        'repo',
      ]);
      expect(service.mcpTokenScopes(authorized, WorkspaceRole.ADMIN)).toEqual([
        'tasks:read',
        'mcp-registry:write',
        'workers:connect',
        'repo',
      ]);
    });
  });

  describe('assertCanIssue', () => {
    it('allows everyday scopes and registry servers’ own scopes', async () => {
      await expect(
        service.assertCanIssue({
          workspaceId: WS_A,
          subjectActorId: 'agent',
          issuerActorId: 'member',
          scopes: ['tasks:read', 'tasks:write', 'repo'],
        }),
      ).resolves.toBeUndefined();
    });

    it('refuses scopes the issuer or the subject does not hold, listing them', async () => {
      const refused = service.assertCanIssue({
        workspaceId: WS_A,
        subjectActorId: 'agent',
        issuerActorId: 'admin',
        scopes: ['tasks:read', 'user:admin', 'installation:admin', 'workers:connect'],
      });
      await expect(refused).rejects.toBeInstanceOf(TokenScopeNotEntitledError);
      await expect(refused).rejects.toMatchObject({
        scopes: ['user:admin', 'installation:admin', 'workers:connect'],
      });
    });

    it('refuses when either actor is not a member', async () => {
      await expect(
        service.assertCanIssue({
          workspaceId: WS_B,
          subjectActorId: 'agent',
          issuerActorId: 'admin',
          scopes: ['tasks:read'],
        }),
      ).rejects.toBeInstanceOf(TokenActorNotInWorkspaceError);
    });
  });
});
