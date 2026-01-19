import { Injectable, InternalServerErrorException, Logger, UnauthorizedException } from "@nestjs/common";
import { createHash, randomBytes } from "crypto";
import { SignJWT, importPKCS8 } from 'jose';
import { RefreshTokenEntity } from "./entities/refresh-token.entity";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { IdentityProviderService } from "../identity-provider/identity-provider.service";
import { getConfig } from "../config/env.config";
import { JwksService } from "../auth/crypto/jwks.service";
import { AccessTokenClaims } from "src/auth/core/types/access-token-claims.type";
import { Scope } from "src/auth/core/types/scope.type";
import { ALL_TASKS_SCOPES, TasksScopes } from "src/tasks/tasks.scopes";
import { ALL_CONTEXT_SCOPES } from "src/context/context.scopes";
import { ALL_MCP_SCOPES } from "src/auth/core/scopes/mcp.scopes";
import { UserScopes } from "src/auth/core/scopes/user.scopes";
import { ALL_AGENTS_SCOPES } from "src/agents/agents.scopes";
import { ALL_MCP_REGISTRY_SCOPES } from "src/mcp-registry/mcp-registry.scopes";
import { ActorEntity } from "src/identity-provider/actor.entity";
import { User } from "src/identity-provider/user.entity";
import { ActorService } from "src/identity-provider/actor.service";


@Injectable()
export class WebAuthService {
  private logger = new Logger(WebAuthService.name);
  private WEB_TOKEN_DURATION_MINUTES: number = 60;

  constructor(
    private readonly identityProviderService: IdentityProviderService,
    private readonly actorService: ActorService,
    private readonly jwksService: JwksService,
    @InjectRepository(RefreshTokenEntity)
    private readonly refreshTokenRepository: Repository<RefreshTokenEntity>,
  ) { }

  /**
   * Web Authentication: Login with email and password
   * Returns access and refresh tokens
   */
  async login(email: string, password: string): Promise<{ accessToken: string; refreshToken: string; expiresInSeconds: number, actor: ActorEntity, user: User }> {
    this.logger.debug(`Login attempt for email: ${email}`);

    // Validate user credentials (throws if user not found or credentials invalid)
    const { user, actor } = await this.identityProviderService.validateUser(email, password);

    // Generate access token (60 min expiration)
    const durationMinutes = this.WEB_TOKEN_DURATION_MINUTES;
    const accessToken = await this.generateWebAccessToken(
      durationMinutes,
      actor,
      user,
    );

    // Generate refresh token (1 day expiration)
    const refreshToken = await this.generateAndStoreRefreshToken(user.id);

    this.logger.log(`User logged in successfully: ${email}`);

    return {
      user,
      actor,
      accessToken,
      refreshToken,
      expiresInSeconds: durationMinutes * 60,
    };
  }


  /**
   * Generate a signed JWT access token for web authentication
   */
  private async generateWebAccessToken(
    durationMinutes: number,
    actor: ActorEntity,
    user: User,
  ): Promise<string> {
    // Get active signing key
    const signingKey = await this.jwksService.getActiveSigningKey();

    // Import private key from PEM
    const privateKey = await importPKCS8(signingKey.privateKeyPem, signingKey.algorithm);

    // Build JWT payload
    const now = Math.floor(Date.now() / 1000);
    const config = getConfig();

    // Determine scopes based on role
    const scopes: Scope[] = [
      ...ALL_TASKS_SCOPES,
      ...ALL_CONTEXT_SCOPES,
      ...ALL_AGENTS_SCOPES,
      ...ALL_MCP_REGISTRY_SCOPES,
      ...ALL_MCP_SCOPES,
      user.role === 'admin' ? UserScopes.ADMIN : UserScopes.STANDARD,
    ]

    const payload: AccessTokenClaims = {
      iss: config.issuerUrl,
      sub: actor.id,
      actor_id: actor.id,
      actor_slug: actor.slug,
      actor_type: actor.type,
      displayName: actor.displayName,
      email: user.email,
      scope: scopes.map(s => s.id),
      aud: 'ai-backend',
      client_id: 'web-app',
      // mcp_server_identifier: 'not needed for non-mcp',
      resource: `${config.issuerUrl}`,
      version: '0.0.0',
      iat: now,
      exp: now + durationMinutes * 60, // duration passed in as a param
      jti: randomBytes(16).toString('hex'),
    };

    // Sign and return JWT
    const jwt = await new SignJWT(payload as any)
      .setProtectedHeader({
        alg: signingKey.algorithm,
        kid: signingKey.kid,
        typ: 'JWT',
      })
      .sign(privateKey);

    return jwt;
  }


  /**
   * Generate and store a refresh token in the database
   * Returns the unhashed token (to be sent to client)
   */
  private async generateAndStoreRefreshToken(userId: string): Promise<string> {
    // Generate a cryptographically secure random token
    const token = randomBytes(32).toString('base64url');

    // Hash the token before storing
    const tokenHash = createHash('sha256').update(token).digest('hex');

    // Calculate expiration (1 day)
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 1);

    // Store in database
    const refreshToken = this.refreshTokenRepository.create({
      userId,
      tokenHash,
      expiresAt,
      revokedAt: null,
    });

    await this.refreshTokenRepository.save(refreshToken);

    // Return the unhashed token
    return token;
  }


  /**
   * Web Authentication: Refresh access token using refresh token
   * Returns new access and refresh tokens
   */
  async refreshWebToken(refreshToken: string): Promise<{ accessToken: string; refreshToken: string; expiresIn: number, user: User, actor: ActorEntity }> {
    this.logger.debug('Refresh token request');

    // Hash the provided refresh token to compare with stored hash
    const tokenHash = createHash('sha256').update(refreshToken).digest('hex');

    // Find the refresh token in database with user and actor relations
    // TODO: should throw if user is gone?
    const storedToken = await this.refreshTokenRepository.findOne({
      where: { tokenHash },
      relations: ['user', 'user.actor'],
    });

    if (!storedToken) {
      this.logger.warn('Refresh token not found');
      throw new UnauthorizedException('Invalid refresh token');
    }

    // Check if token is revoked
    if (storedToken.revokedAt) {
      this.logger.warn('Refresh token has been revoked');
      throw new UnauthorizedException('Refresh token revoked');
    }

    // Check if token is expired
    if (new Date() > storedToken.expiresAt) {
      this.logger.warn('Refresh token expired');
      throw new UnauthorizedException('Refresh token expired');
    }

    // Revoke the old refresh token
    storedToken.revokedAt = new Date();
    await this.refreshTokenRepository.save(storedToken);

    // Generate new tokens
    const user = storedToken.user;
    if (!user) {
      this.logger.error("User not found for refresh token. This should not happen");
      // TODO: this is an HTTP exception. Should be service error.
      throw new InternalServerErrorException('Failed to retrieve user');
    }
    const actor = storedToken.user.actor;
    if (!actor) {
      this.logger.error("Actor not found for refresh token. This should not happen");
      // TODO: this is an HTTP exception. Should be service error.
      throw new InternalServerErrorException('Failed to retrieve actor');
    }

    const newAccessToken = await this.generateWebAccessToken(
      this.WEB_TOKEN_DURATION_MINUTES,
      actor,
      user,
    );
    const newRefreshToken = await this.generateAndStoreRefreshToken(user.id);

    this.logger.log(`Refresh token exchanged successfully for user: ${user.email}`);

    return {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
      expiresIn: 600, // 10 minutes
      actor,
      user,
    };
  }
}
