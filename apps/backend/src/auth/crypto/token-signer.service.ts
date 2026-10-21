import { Injectable } from '@nestjs/common';
import { TokenSigner } from '@taico/auth';
import { getConfig } from 'src/config/env.config';
import { AccessTokenClaims } from '../core/types/access-token-claims.type';
import { JwksService } from './jwks.service';

/** The one place tokens are signed */
@Injectable()
export class TokenSignerService {
  private readonly signer: TokenSigner;

  constructor(jwksService: JwksService) {
    this.signer = new TokenSigner(jwksService.keys, getConfig().issuerUrl);
  }

  signToken(claims: AccessTokenClaims): Promise<string> {
    return this.signer.sign({ ...claims });
  }
}
