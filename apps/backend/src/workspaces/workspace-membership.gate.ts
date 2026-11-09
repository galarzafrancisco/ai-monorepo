import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import type { AuthContext } from '../auth/guards/context/auth-context.types';
import { WorkspaceMemberRemovedEvent } from './workspace-member-removed.event';
import { authActorId } from './workspace-rooms';
import { WorkspacesService } from './workspaces.service';

/** How long a membership answer is reused on one backend. */
const MEMBERSHIP_CACHE_TTL_MS = 10_000;
const MEMBERSHIP_CACHE_MAX = 10_000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Whether a token's actor is still a member of the token's workspace, checked
 * on every request to workspace data (HTTP, MCP and sockets). Tokens are only
 * minted for members, but a person removed later must lose access at once,
 * not when their token expires.
 *
 * Answers are cached briefly per backend. A removal clears its entry here at
 * once; other backends see it within `MEMBERSHIP_CACHE_TTL_MS`.
 * See docs/architecture/workspaces.md, "Removing a member".
 */
@Injectable()
export class WorkspaceMembershipGate {
  private readonly cache = new Map<string, { member: boolean; until: number }>();

  constructor(private readonly workspacesService: WorkspacesService) {}

  async isMember(auth: AuthContext): Promise<boolean> {
    const key = `${auth.workspaceId}:${authActorId(auth)}`;
    const now = Date.now();
    const cached = this.cache.get(key);
    if (cached && cached.until > now) {
      return cached.member;
    }
    // Signed tokens always name actors by UUID; anything else is no member.
    const member =
      UUID.test(authActorId(auth)) && UUID.test(auth.workspaceId)
        ? await this.workspacesService.isMember(auth.workspaceId, authActorId(auth))
        : false;
    if (this.cache.size >= MEMBERSHIP_CACHE_MAX) {
      this.cache.clear();
    }
    this.cache.set(key, { member, until: now + MEMBERSHIP_CACHE_TTL_MS });
    return member;
  }

  @OnEvent(WorkspaceMemberRemovedEvent.INTERNAL)
  onMemberRemoved(event: WorkspaceMemberRemovedEvent): void {
    this.cache.delete(`${event.workspaceId}:${event.actorId}`);
  }
}
