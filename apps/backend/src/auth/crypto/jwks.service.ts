import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { KeyManager } from '@taico/auth';
import type { JWK } from 'jose';
import { LessThan, Repository } from 'typeorm';
import { getConfig } from 'src/config/env.config';
import { JwksKeyEntity } from './jwks-key.entity';
import { JwksKeyStore } from './jwks-key.store';

/**
 * The issuer's signing keys. Creation, rotation and the in-memory key cache
 * live in `@taico/auth`'s KeyManager; this service configures it for Taico.
 */
@Injectable()
export class JwksService {
  private readonly logger = new Logger(JwksService.name);
  readonly keys: KeyManager;

  constructor(
    store: JwksKeyStore,
    @InjectRepository(JwksKeyEntity)
    private readonly keyRepository: Repository<JwksKeyEntity>,
  ) {
    const config = getConfig();
    this.keys = new KeyManager({
      store,
      signingTtlHours: config.jwksKeySigningTtlHours,
      verifyingTtlHours: config.jwksKeyVerifyingTtlHours,
      logger: this.logger,
    });
  }

  /**
   * Public keys that may still verify a token: the active key and recently
   * rotated ones. Cached, so this does not query the database per token.
   */
  getPublicKeys(options?: { forceRefresh?: boolean }): Promise<JWK[]> {
    return this.keys.getKeys(options);
  }

  /** Create a new signing key and retire the current one */
  async rotateKey(): Promise<void> {
    this.logger.log('Rotating JWKS key');
    await this.keys.rotate();
  }

  /**
   * Clean up expired keys (can be called by a cron job)
   * Soft deletes keys that have been expired for more than the grace period
   */
  async cleanupExpiredKeys(gracePeriodDays: number = 7): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - gracePeriodDays);

    const result = await this.keyRepository.softDelete({
      expiresAt: LessThan(cutoffDate),
    });

    const deletedCount = result.affected || 0;
    if (deletedCount > 0) {
      this.logger.log(`Soft deleted ${deletedCount} expired keys`);
    }

    return deletedCount;
  }
}
