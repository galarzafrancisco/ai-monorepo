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

@Injectable()
export class WsAccessTokenGuard implements CanActivate {
  private logger = new Logger(WsAccessTokenGuard.name);

  constructor(private readonly validator: AccessTokenValidationService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    this.logger.log('WsAccessTokenGuard: canActivate called');

    const client = context.switchToWs().getClient<Socket>();
    if (client.data.auth) {
      return true;
    }

    const handshake = client.handshake;

    // 1) Extract token
    const token =
      handshake.auth?.token ||
      tokenFromHeaders(handshake.headers) ||
      tokenFromCookies(cookie.parse(handshake.headers.cookie || ''));

    if (!token) {
      client.disconnect(true);
      return false;
    }
    this.logger.log(
      `Extracted WS token: ${token.replace(/(.{4}).+(.{4})/, '$1...$2')}`,
    );

    // 2) Validate
    let claims: AccessTokenClaims;
    try {
      claims = await this.validator.validateAccessToken(token);
    } catch {
      client.disconnect(true);
      return false;
    }

    // 3) Attach context (same shape as HTTP)
    const authContext: AuthContext = {
      token,
      claims,
      scopes: claims.scope,
      subject: claims.sub,
    };
    client.data.auth = authContext;

    return true;
  }
}
