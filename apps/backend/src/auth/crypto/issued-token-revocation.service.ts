import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { RevocationChecker } from '@taico/auth';
import { IsNull, Not, Repository } from 'typeorm';
import { IssuedAccessTokenEntity } from 'src/authorization-server/entities/issued-access-token.entity';

/**
 * Answers whether an access token was revoked, from `issued_access_tokens`.
 * The token verifier asks on every verification, so revoking an agent token
 * takes effect on its next request instead of when the token expires.
 */
@Injectable()
export class IssuedTokenRevocationService implements RevocationChecker {
  constructor(
    @InjectRepository(IssuedAccessTokenEntity)
    private readonly tokenRepository: Repository<IssuedAccessTokenEntity>,
  ) {}

  isRevoked(jti: string): Promise<boolean> {
    // `jti` is unique, so this is a single index lookup
    return this.tokenRepository.exists({
      where: { jti, revokedAt: Not(IsNull()) },
    });
  }
}
