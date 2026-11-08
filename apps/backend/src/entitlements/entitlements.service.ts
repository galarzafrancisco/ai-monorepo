import { Injectable } from '@nestjs/common';
import { mcpServerRequiresTaicoAuth } from '@taico/shared';
import { WorkspaceRole } from 'src/workspaces/enums';
import { NoWorkspaceMembershipError } from 'src/workspaces/workspace.errors';
import { WorkspacesService } from 'src/workspaces/workspaces.service';
import {
  TokenActorNotInWorkspaceError,
  TokenScopeNotEntitledError,
} from './entitlements.errors';
import {
  ADMIN_SCOPE_IDS,
  INSTALLATION_SCOPE_IDS,
  MEMBER_SCOPE_IDS,
  TAICO_SCOPE_IDS,
  WORKSPACE_ADMIN_SCOPE_IDS,
} from './entitlements.scopes';

/** An actor's standing in one workspace. */
export type Entitlement = {
  workspaceId: string;
  role: WorkspaceRole;
};

/**
 * The one place that decides workspace entitlements: which workspaces an
 * actor may work in, with which role, and which scopes a token may carry
 * there. Every path that mints a token asks it, and asks again on refresh,
 * so a removed or demoted member loses access at their next token.
 *
 * Rules (docs/architecture/workspaces.md, "Entitlements"):
 * - A member holds every API scope except the workspace-admin ones; an admin
 *   holds those too. `installation:admin` is never a workspace entitlement:
 *   it follows the installation role, in web sessions only.
 * - Web sessions land in the workspace asked for while the person is still
 *   in it, else their oldest one.
 * - Every other token is bound to one workspace and refused once its actor
 *   is no longer a member. It never moves to another workspace.
 * - A token handed out (agent and execution tokens) carries no Taico scope
 *   that its subject or its issuer is not entitled to.
 */
@Injectable()
export class EntitlementsService {
  constructor(private readonly workspacesService: WorkspacesService) {}

  /** The actor's role in a workspace, or null if they are not a member. */
  roleIn(workspaceId: string, actorId: string): Promise<WorkspaceRole | null> {
    return this.workspacesService.findRole(workspaceId, actorId);
  }

  /**
   * The actor's entitlement in a workspace they must be a member of.
   *
   * @throws {TokenActorNotInWorkspaceError} if they are not a member.
   */
  async requireMembership(
    workspaceId: string,
    actorId: string,
  ): Promise<Entitlement> {
    const role = await this.roleIn(workspaceId, actorId);
    if (!role) {
      throw new TokenActorNotInWorkspaceError(actorId, workspaceId);
    }
    return { workspaceId, role };
  }

  /**
   * The workspace a web session works in: `preferredWorkspaceId` while the
   * person is still a member of it, otherwise their oldest membership.
   *
   * @throws {NoWorkspaceMembershipError} if they are in no workspace. A
   *   token with no `workspace_id` would be read as the default workspace.
   */
  async sessionEntitlement(
    actorId: string,
    preferredWorkspaceId: string | null,
  ): Promise<Entitlement> {
    if (preferredWorkspaceId) {
      const role = await this.roleIn(preferredWorkspaceId, actorId);
      if (role) {
        return { workspaceId: preferredWorkspaceId, role };
      }
    }
    const membership =
      await this.workspacesService.findMembershipForActor(actorId);
    if (!membership) {
      throw new NoWorkspaceMembershipError(actorId);
    }
    return membership;
  }

  /** The scopes a web session holds. */
  webSessionScopes(
    entitlement: Entitlement,
    installation: { operator: boolean },
  ): string[] {
    return [
      ...this.roleScopes(entitlement.role),
      ...(installation.operator ? INSTALLATION_SCOPE_IDS : []),
    ];
  }

  /**
   * The workspace an MCP OAuth token (MCP clients and workers) works in.
   *
   * - Taico's own servers (tasks, context, the worker target) serve every
   *   workspace: the token is for the workspace the person consented in.
   *   Journeys from before that was recorded use their oldest membership.
   * - Any other server belongs to one workspace: the token is for it.
   *
   * Checked on every code exchange and refresh.
   *
   * @throws {TokenActorNotInWorkspaceError} if the person is no longer a
   *   member of that workspace.
   * @throws {NoWorkspaceMembershipError} if a legacy journey's person is in
   *   no workspace.
   */
  async mcpTokenEntitlement(
    server: { providedId: string; workspaceId: string },
    actorId: string,
    consentWorkspaceId: string | null,
  ): Promise<Entitlement> {
    if (!mcpServerRequiresTaicoAuth(server.providedId)) {
      return this.requireMembership(server.workspaceId, actorId);
    }
    if (consentWorkspaceId) {
      return this.requireMembership(consentWorkspaceId, actorId);
    }
    return this.sessionEntitlement(actorId, null);
  }

  /**
   * The scopes an MCP OAuth token carries: the ones it was authorized for
   * (already limited to what its server offers), less the workspace-admin
   * scopes for a member and the installation scopes for anyone. A server's
   * own client scopes (`workers:connect` for the worker target) and an MCP
   * registry server's own scopes are kept.
   */
  mcpTokenScopes(authorizedScopes: string[], role: WorkspaceRole): string[] {
    return authorizedScopes.filter(
      (scope) =>
        !INSTALLATION_SCOPE_IDS.includes(scope) &&
        (role === WorkspaceRole.ADMIN ||
          !WORKSPACE_ADMIN_SCOPE_IDS.includes(scope)),
    );
  }

  /**
   * Checks that a token handed out to `subjectActorId` by `issuerActorId`
   * (agent and execution tokens) may be minted in `workspaceId` with
   * `scopes`: both are members, and every Taico scope is one both of them
   * hold there. An MCP registry server's own scopes are not Taico's and are
   * left to the agent's tool permissions.
   *
   * @throws {TokenActorNotInWorkspaceError} if either is not a member.
   * @throws {TokenScopeNotEntitledError} listing the scopes they may not grant.
   */
  async assertCanIssue(input: {
    workspaceId: string;
    subjectActorId: string;
    issuerActorId: string;
    scopes: string[];
  }): Promise<void> {
    const subject = await this.requireMembership(
      input.workspaceId,
      input.subjectActorId,
    );
    const issuer = await this.requireMembership(
      input.workspaceId,
      input.issuerActorId,
    );
    const subjectScopes = this.roleScopes(subject.role);
    const issuerScopes = this.roleScopes(issuer.role);
    const notEntitled = input.scopes.filter(
      (scope) =>
        TAICO_SCOPE_IDS.has(scope) &&
        !(subjectScopes.includes(scope) && issuerScopes.includes(scope)),
    );
    if (notEntitled.length > 0) {
      throw new TokenScopeNotEntitledError(notEntitled);
    }
  }

  private roleScopes(role: WorkspaceRole): readonly string[] {
    return role === WorkspaceRole.ADMIN ? ADMIN_SCOPE_IDS : MEMBER_SCOPE_IDS;
  }
}
