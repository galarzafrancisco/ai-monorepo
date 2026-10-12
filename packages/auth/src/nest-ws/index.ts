import {
  Inject,
  Injectable,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { bearerTokenFrom, parseCookies } from '../core/challenge.js';
import type { ResourceServer } from '../core/resource-server.js';
import { hasScopes, type RequiredScopes } from '../core/scopes.js';
import type { AuthContext } from '../core/types.js';
import { AUTH_RESOURCE_SERVER, REQUIRED_SCOPES_KEY } from '../nest/index.js';

/*
 * Guards for socket.io gateways. Kept apart from `@taico/auth/nest` so an
 * app without websockets does not need socket.io. The socket is typed
 * structurally, so this module does not import socket.io either.
 */

/** The parts of a socket.io `Socket` the guards use */
export type AuthSocket = {
  handshake: {
    auth?: Record<string, unknown>;
    headers: Record<string, string | string[] | undefined>;
  };
  data: { auth?: AuthContext } & Record<string, unknown>;
  disconnect(close?: boolean): unknown;
};

/**
 * Authenticates a socket once, from `handshake.auth.token`, a Bearer header
 * or the session cookie, and keeps the result in `socket.data.auth`.
 * Disconnects sockets that fail.
 *
 * A socket has no URL of its own to bind a token to, so it is checked
 * against the resource server's base URL: only tokens for the API as a
 * whole pass, not tokens minted for one resource.
 */
@Injectable()
export class WsAccessTokenGuard implements CanActivate {
  constructor(
    @Inject(AUTH_RESOURCE_SERVER) private readonly auth: ResourceServer,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const socket = context.switchToWs().getClient<AuthSocket>();
    if (socket.data.auth) {
      return true;
    }
    try {
      socket.data.auth = await authenticateSocket(this.auth, socket);
      return true;
    } catch {
      socket.disconnect(true);
      return false;
    }
  }
}

/** Authenticates a socket.io handshake. Throws `AuthError` when it fails. */
export async function authenticateSocket(
  auth: ResourceServer,
  socket: Pick<AuthSocket, 'handshake'>,
  cookieName = 'access_token',
): Promise<AuthContext> {
  const { handshake } = socket;
  const handshakeToken = handshake.auth?.token;
  const token =
    (typeof handshakeToken === 'string' && handshakeToken) ||
    bearerTokenFrom(handshake.headers.authorization) ||
    parseCookies(handshake.headers.cookie)[cookieName];
  return auth.authenticate(
    { authorization: token ? `Bearer ${token}` : undefined },
    auth.requestUrl(''),
  );
}

/** Enforces `@RequireScopes` on gateway handlers. Disconnects on failure. */
@Injectable()
export class WsScopesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const socket = context.switchToWs().getClient<AuthSocket>();
    const required = this.reflector.getAllAndOverride<RequiredScopes | undefined>(
      REQUIRED_SCOPES_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!required || required.scopes.length === 0) {
      return true;
    }
    const auth = socket.data?.auth;
    if (!auth || !hasScopes(auth.scopes, required.scopes, required.mode)) {
      socket.disconnect(true);
      return false;
    }
    return true;
  }
}
