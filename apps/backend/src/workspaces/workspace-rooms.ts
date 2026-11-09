import type { Socket } from 'socket.io';
import type { AuthContext } from '../auth/guards/context/auth-context.types';

/**
 * The name of a realtime room inside a workspace. Every room that carries
 * workspace data is prefixed this way, so a socket only hears its own
 * workspace. See docs/architecture/workspaces.md.
 */
export function workspaceRoom(workspaceId: string, room: string): string {
  return `workspace:${workspaceId}:${room}`;
}

/**
 * The workspace of an authenticated socket (from its access token). Use it in
 * gateway handlers that join rooms; `@CurrentWorkspace()` gives the same value
 * as a handler parameter.
 */
export function socketWorkspaceId(client: Socket): string {
  const auth = client.data?.auth as AuthContext | undefined;
  if (!auth) {
    throw new Error('socketWorkspaceId() used on an unauthenticated socket');
  }
  return auth.workspaceId;
}

/**
 * Every authenticated socket of an actor in a workspace joins this room, so a
 * removal can disconnect them all, on every backend (the socket adapter
 * carries `disconnectSockets` across instances).
 */
export function workspaceMemberRoom(workspaceId: string, actorId: string): string {
  return workspaceRoom(workspaceId, `member:${actorId}`);
}

/** The actor an auth context acts as (the token's subject). */
export function authActorId(auth: AuthContext): string {
  return auth.claims.actor_id || auth.subject;
}
