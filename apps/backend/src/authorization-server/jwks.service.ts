import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan, LessThan } from 'typeorm';
import { JwksKeyEntity } from './jwks-key.entity';
import { generateKeyPair, exportJWK, exportPKCS8, exportSPKI, calculateJwkThumbprint, importSPKI, JWK } from 'jose';
import { createPublicKey, randomBytes } from 'crypto';


/* -------- algorithm -------- */
const ALG          = 'RS256' as const   // keep the string literal

@Injectable()
export class JwksService {
  private logger = new Logger(JwksService.name);

  constructor(
    @InjectRepository(JwksKeyEntity)
    private readonly keyRepository: Repository<JwksKeyEntity>,
  ) {}

  /**
   * Get the current active key, or create a new one if none exists or current is expired
   */
  async getOrCreateActiveKey(): Promise<JwksKeyEntity> {
    // Try to find an active, non-expired key
    const now = new Date();
    const activeKey = await this.keyRepository.findOne({
      where: {
        isActive: true,
        expiresAt: MoreThan(now),
      },
      order: {
        createdAt: 'DESC',
      },
    });

    if (activeKey) {
      this.logger.debug(`Using existing active key: ${activeKey.kid}`);
      return activeKey;
    }

    // No active key found, create a new one
    this.logger.log('No active key found, creating new key');
    return this.rotateKey();
  }

  /**
   * Create a new key and mark the old active key as inactive
   */
  async rotateKey(): Promise<JwksKeyEntity> {
    this.logger.log('Rotating JWKS key');

    // Mark all currently active keys as inactive
    await this.keyRepository.update(
      { isActive: true },
      { isActive: false },
    );

    // Generate new RSA key pair
    const { publicKey, privateKey } = await generateKeyPair(ALG, {
      modulusLength: 2048,
      extractable: true, // Required to export keys to PEM format
    });

    // Export keys to PEM format for storage
    const publicKeyPem = await exportSPKI(publicKey);
    const privateKeyPem = await exportPKCS8(privateKey);
    
    // Generate a unique key ID
    const publicJwk = await exportJWK(publicKey);
    const kid = await calculateJwkThumbprint(publicJwk);

    // Calculate expiration date based on TTL
    const ttlHours = parseInt(process.env.JWKS_KEY_TTL_HOURS || '24', 10);
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + ttlHours);

    // Create and save the new key
    const newKey = this.keyRepository.create({
      kid,
      publicKeyPem: publicKeyPem,
      privateKeyPem: privateKeyPem,
      algorithm: ALG,
      isActive: true,
      expiresAt,
    });

    const savedKey = await this.keyRepository.save(newKey);
    this.logger.log(`Created new key: ${savedKey.kid}, expires at: ${savedKey.expiresAt.toISOString()}`);

    return savedKey;
  }

  /**
   * Get all valid keys (not expired, not soft-deleted) for the JWKS endpoint
   * This includes both active and inactive keys to allow validation of tokens
   * signed with recently rotated keys
   */
  async getPublicKeys(): Promise<JWK[]> {
    const now = new Date();
    const validKeys = await this.keyRepository.find({
      where: {
        expiresAt: MoreThan(now),
      },
      order: {
        createdAt: 'DESC',
      },
    });

    this.logger.debug(`Found ${validKeys.length} valid keys for JWKS endpoint`);

    // Convert stored keys to JWK format
    const jwks: JWK[] = await Promise.all(
      validKeys.map(async (key) => {
        
        const publicKey = await importSPKI(key.publicKeyPem, key.algorithm)

        // Export as JWK
        const publicJwk = await exportJWK(publicKey);
        publicJwk.use = 'sig';
        publicJwk.alg = key.algorithm;
        publicJwk.kid = key.kid;

        return publicJwk;
      }),
    );

    return jwks;
  }

  /**
   * Get the active signing key (for signing JWTs)
   */
  async getActiveSigningKey(): Promise<JwksKeyEntity> {
    return this.getOrCreateActiveKey();
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
