import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { randomBytes } from 'crypto';
import { IssuedAccessTokenEntity } from './entities/issued-access-token.entity';
import { TokenSignerService } from '../auth/crypto/token-signer.service';
import { AccessTokenClaims } from '../auth/core/types/access-token-claims.type';
import { ActorEntity } from '../identity-provider/actor.entity';
import { getConfig } from '../config/env.config';

/**
 * Input for issuing a new access token
 */
export interface IssueTokenInput {
  /** The actor this token is for (subject) */
  subjectActor: ActorEntity;
  /** The actor issuing this token (must be human) */
  issuedByActor: ActorEntity;
  /** Human-readable name for this token */
  name: string;
  /** Scopes to grant */
  scopes: string[];
  /** Days until expiration (default: 30) */
  expirationDays?: number;
}

/**
 * Result of issuing a new access token
 */
export interface IssueTokenResult {
  /** Database entity for the token record */
  entity: IssuedAccessTokenEntity;
  /** The raw JWT (only available at creation time) */
  token: string;
}

/**
 * Service for issuing and managing long-lived access tokens.
 * Generic design - can issue tokens for any actor (agents, services, etc.)
 *
 * The actual subject validation (e.g., "is this agent valid?") should be done
 * by the calling code before invoking this service.
 */
@Injectable()
export class IssuedAccessTokenService {
  private readonly logger = new Logger(IssuedAccessTokenService.name);

  constructor(
    @InjectRepository(IssuedAccessTokenEntity)
    private readonly tokenRepository: Repository<IssuedAccessTokenEntity>,
    private readonly tokenSignerService: TokenSignerService,
  ) {}

  /**
   * Issue a new long-lived access token for an actor.
   * Returns both the database record and the raw JWT (shown only once).
   */
  async issueToken(input: IssueTokenInput): Promise<IssueTokenResult> {
    const config = getConfig();
    const expirationDays = input.expirationDays ?? 30;

    // Generate unique token ID (jti)
    const jti = randomBytes(16).toString('hex');

    // Calculate expiration
    const now = Math.floor(Date.now() / 1000);
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + expirationDays);
    const expSeconds = now + expirationDays * 24 * 60 * 60;

    // Build JWT claims
    const claims: AccessTokenClaims = {
      iss: config.issuerUrl,
      sub: input.subjectActor.id,
      actor_id: input.subjectActor.id,
      actor_slug: input.subjectActor.slug,
      actor_type: input.subjectActor.type,
      displayName: input.subjectActor.displayName,
      aud: config.issuerUrl, // Self-issued tokens audience is the issuer
      exp: expSeconds,
      iat: now,
      jti,
      client_id: 'issued-token', // Special client_id for manually issued tokens
      scope: input.scopes,
      resource: config.issuerUrl,
      version: '1.0.0',
      // Custom claim to track who issued this token
      issued_by: input.issuedByActor.id,
    };

    // Sign the JWT
    const token = await this.tokenSignerService.signToken(claims);

    // Store token metadata in database
    const entity = this.tokenRepository.create({
      subjectActorId: input.subjectActor.id,
      issuedByActorId: input.issuedByActor.id,
      jti,
      name: input.name,
      scopes: input.scopes,
      expiresAt,
      revokedAt: null,
      lastUsedAt: null,
    });

    const savedEntity = await this.tokenRepository.save(entity);

    this.logger.log(
      `Issued access token "${input.name}" for actor ${input.subjectActor.slug} ` +
        `(expires: ${expiresAt.toISOString()})`,
    );

    return {
      entity: savedEntity,
      token,
    };
  }

  /**
   * List all tokens issued for a specific subject actor
   */
  async listTokensForSubject(
    subjectActorId: string,
  ): Promise<IssuedAccessTokenEntity[]> {
    return this.tokenRepository.find({
      where: { subjectActorId },
      relations: ['subjectActor', 'issuedByActor'],
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Get a specific token by ID
   */
  async getTokenById(tokenId: string): Promise<IssuedAccessTokenEntity | null> {
    return this.tokenRepository.findOne({
      where: { id: tokenId },
      relations: ['subjectActor', 'issuedByActor'],
    });
  }

  /**
   * Revoke a token by its database ID
   */
  async revokeTokenById(
    tokenId: string,
  ): Promise<IssuedAccessTokenEntity | null> {
    const token = await this.tokenRepository.findOne({
      where: { id: tokenId },
      relations: ['subjectActor', 'issuedByActor'],
    });

    if (!token) {
      return null;
    }

    if (token.revokedAt) {
      // Already revoked
      return token;
    }

    token.revokedAt = new Date();
    const savedToken = await this.tokenRepository.save(token);

    this.logger.log(`Revoked token "${token.name}" (id: ${tokenId})`);

    return savedToken;
  }

  /**
   * Revoke a token by its JTI (from JWT claims)
   */
  async revokeTokenByJti(jti: string): Promise<IssuedAccessTokenEntity | null> {
    const token = await this.tokenRepository.findOne({
      where: { jti },
      relations: ['subjectActor', 'issuedByActor'],
    });

    if (!token) {
      return null;
    }

    if (token.revokedAt) {
      return token;
    }

    token.revokedAt = new Date();
    const savedToken = await this.tokenRepository.save(token);

    this.logger.log(`Revoked token by jti "${jti}"`);

    return savedToken;
  }

  /**
   * Check if a token (by jti) is revoked
   */
  async isTokenRevoked(jti: string): Promise<boolean> {
    const token = await this.tokenRepository.findOne({
      where: { jti },
    });

    if (!token) {
      // Token not found in database - could be an MCP token or invalid
      return false;
    }

    return token.revokedAt !== null;
  }

  /**
   * Update last used timestamp for a token
   */
  async updateLastUsed(jti: string): Promise<void> {
    await this.tokenRepository.update({ jti }, { lastUsedAt: new Date() });
  }
}
