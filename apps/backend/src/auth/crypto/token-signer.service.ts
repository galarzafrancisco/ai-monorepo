import { Injectable, Logger } from '@nestjs/common';
import { JwksService } from './jwks.service';
import { AccessTokenClaims } from '../core/types/access-token-claims.type';
import { importPKCS8, SignJWT } from 'jose';

@Injectable()
export class TokenSignerService {
  private logger = new Logger(TokenSignerService.name);

  constructor(private readonly jwksService: JwksService) {}

  async signToken(claims: AccessTokenClaims): Promise<string> {
    const signingKey = await this.jwksService.getActiveSigningKey();
    const privateKey = await importPKCS8(
      signingKey.privateKeyPem,
      signingKey.algorithm,
    );

    const jwt = await new SignJWT(claims as any)
      .setProtectedHeader({
        alg: signingKey.algorithm,
        kid: signingKey.kid,
        typ: 'JWT',
      })
      .sign(privateKey);

    return jwt;
  }
}
