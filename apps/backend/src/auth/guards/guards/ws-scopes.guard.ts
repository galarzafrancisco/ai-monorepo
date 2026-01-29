import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Socket } from 'socket.io';
import {
  REQUIRED_SCOPES_KEY,
  RequiredScopesMetadata,
} from '../decorators/require-scopes.decorator';
import { AuthContext } from '../context/auth-context.types';

@Injectable()
export class WsScopesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const client = ctx.switchToWs().getClient<Socket>();

    const meta = this.reflector.getAllAndOverride<RequiredScopesMetadata>(
      REQUIRED_SCOPES_KEY,
      [ctx.getHandler(), ctx.getClass()],
    );

    // No scopes required => allow
    if (!meta || meta.scopes.length === 0) return true;

    const auth = client.data?.auth as AuthContext | undefined;
    if (!auth) return false;

    const tokenScopes = new Set(auth.scopes);
    const required = meta.scopes;

    const ok =
      meta.mode === 'any'
        ? required.some((s) => tokenScopes.has(s))
        : required.every((s) => tokenScopes.has(s));

    if (!ok) {
      client.disconnect(true);
      return false;
    }

    return true;
  }
}
