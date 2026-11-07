import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
} from '@nestjs/common';
import { AccessTokenValidationService } from '../validation/access-token-validation.service';
import { Socket } from 'socket.io';
import { tokenFromHeaders } from '../extractors/token-header.extractor';
import { tokenFromCookies } from '../extractors/token-cookie.extractor';
import * as cookie from 'cookie';
import { AccessTokenClaims } from 'src/auth/core/types/access-token-claims.type';
import { AuthContext } from '../context/auth-context.types';
import { createAuthContext } from '../context/auth-context.factory';
import { isFirstPartyAudience } from 'src/auth/core/resource-audience';
import { Reflector } from '@nestjs/core';
import {
  enforceWorkspaceAccess,
  entryPointName,
  workspaceAccessOf,
} from './workspace-access';

@Injectable()
export class WsAccessTokenGuard implements CanActivate {
  private logger = new Logger(WsAccessTokenGuard.name);

  constructor(
    private readonly validator: AccessTokenValidationService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const client = context.switchToWs().getClient<Socket>();
    const auth = (client.data.auth as AuthContext | undefined) ?? (await this.authenticate(client));
    if (!auth) {
      return false;
    }

    // Keep workspaces apart, on every message (fails closed when the handler
    // declares no mode). Refused messages answer with an `exception` event.
    try {
      enforceWorkspaceAccess(
        workspaceAccessOf(this.reflector, context),
        auth,
        entryPointName(context),
      );
    } catch (error) {
      this.logger.warn({
        message: 'WebSocket message refused by workspace access',
        entryPoint: entryPointName(context),
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
    return true;
  }

  /** Validates the handshake token once per socket and attaches the auth context. */
  private async authenticate(client: Socket): Promise<AuthContext | undefined> {
    const handshake = client.handshake;

    // 1) Extract token
    const token =
      handshake.auth?.token ||
      tokenFromHeaders(handshake.headers) ||
      tokenFromCookies(cookie.parse(handshake.headers.cookie || ''));

    if (!token) {
      client.disconnect(true);
      return undefined;
    }

    // 2) Validate
    let claims: AccessTokenClaims;
    try {
      claims = await this.validator.validateAccessToken(token);
    } catch {
      client.disconnect(true);
      return undefined;
    }

    // 3) Sockets are part of the API itself, so only first-party tokens
    if (!isFirstPartyAudience(claims.aud)) {
      client.disconnect(true);
      return undefined;
    }

    // 4) Attach context (same shape as HTTP)
    const authContext: AuthContext = createAuthContext(token, claims);
    client.data.auth = authContext;
    return authContext;
  }
}
