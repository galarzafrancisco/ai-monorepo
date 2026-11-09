import { Injectable } from '@nestjs/common';
import type { AuthContext } from '../auth/guards/context/auth-context.types';
import { authActorId } from './workspace-rooms';
import { WorkspacesService } from './workspaces.service';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Whether a token's actor is still a member of the token's workspace, checked
 * on every request to workspace data (HTTP, MCP and sockets). Tokens are only
 * minted for members, but a person removed later must lose access at once,
 * not when their token expires.
 *
 * Deliberately uncached: every check reads the database (a point lookup on
 * the unique `(workspace_id, actor_id)` index). A cache would keep a removed
 * member in on the other backends until it expired, and a lookup still in
 * flight when the removal commits could put them back in.
 * See docs/architecture/workspaces.md, "Removing a member".
 */
@Injectable()
export class WorkspaceMembershipGate {
  constructor(private readonly workspacesService: WorkspacesService) {}

  async isMember(auth: AuthContext): Promise<boolean> {
    const actorId = authActorId(auth);
    // Signed tokens always name actors and workspaces by UUID; anything else is no member.
    if (!UUID.test(actorId) || !UUID.test(auth.workspaceId)) {
      return false;
    }
    return this.workspacesService.isMember(auth.workspaceId, actorId);
  }
}
