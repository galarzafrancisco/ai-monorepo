import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request, Response } from 'express';

import {
  REQUIRED_SCOPES_KEY,
  RequiredScopesMetadata,
} from '../decorators/require-scopes.decorator';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import type { AuthContext } from '../context/auth-context.types';
import {
  InvalidAccessTokenError,
  InsufficientScopeError,
} from '../errors/access-token.errors';

@Injectable()
export class ScopesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    // Respect @Public()
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const meta = this.reflector.getAllAndOverride<
      RequiredScopesMetadata | undefined
    >(REQUIRED_SCOPES_KEY, [context.getHandler(), context.getClass()]);

    // No scopes required => allow
    if (!meta || meta.scopes.length === 0) return true;

    const req = context.switchToHttp().getRequest<Request>();
    const res = context.switchToHttp().getResponse<Response>();

    // You currently attach auth context here:
    // res.locals.auth = authContext;
    const auth = res.locals?.auth as AuthContext | undefined;

    // If someone forgot to apply AccessTokenGuard globally, fail closed
    if (!auth) {
      throw new InvalidAccessTokenError(
        'Missing auth context (did AccessTokenGuard run?)',
      );
    }

    const tokenScopes = new Set((auth.scopes ?? []).filter(Boolean));
    const required = meta.scopes;

    const ok =
      meta.mode === 'any'
        ? required.some((s) => tokenScopes.has(s))
        : required.every((s) => tokenScopes.has(s));

    if (!ok) {
      // TODO: figure out how we map this error to WWW-Authenticate headers with the required scopes
      throw new InsufficientScopeError(
        `Missing required scope(s): ${required.join(', ')} (mode=${meta.mode})`,
      );
    }

    // Optional: expose the required scopes for downstream logging
    // req['requiredScopes'] = meta;

    return true;
  }
}
