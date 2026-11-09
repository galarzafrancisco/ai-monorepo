import { WEB_SESSION_AUDIENCE } from '../auth/core/resource-audience';
import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { createHash, randomBytes } from 'crypto';
import { RefreshTokenEntity } from './entities/refresh-token.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { IdentityProviderService } from '../identity-provider/identity-provider.service';
import { getConfig } from '../config/env.config';
import { TokenSignerService } from '../auth/crypto/token-signer.service';
import { NotInWorkspaceError } from '../workspaces/workspace.errors';
import {
  Entitlement,
  EntitlementsService,
} from '../entitlements/entitlements.service';
import { UserRole } from 'src/identity-provider/enums';
import { AccessTokenClaims } from 'src/auth/core/types/access-token-claims.type';
import { ActorEntity } from 'src/identity-provider/actor.entity';
import { User } from 'src/identity-provider/user.entity';
import { ActorService } from 'src/identity-provider/actor.service';
import {
  RefreshTokenActorMissingError,
  RefreshTokenUserMissingError,
} from './errors/web-auth.errors';

@Injectable()
export class WebAuthService {
  private logger = new Logger(WebAuthService.name);

  constructor(
    private readonly identityProviderService: IdentityProviderService,
    private readonly actorService: ActorService,
    private readonly tokenSignerService: TokenSignerService,
    private readonly entitlementsService: EntitlementsService,
    @InjectRepository(RefreshTokenEntity)
    private readonly refreshTokenRepository: Repository<RefreshTokenEntity>,
  ) {}

  /**
   * Web Authentication: Login with email and password
   * Returns access and refresh tokens
   */
  async login(
    email: string,
    password: string,
  ): Promise<{
    accessToken: string;
    refreshToken: string;
    expiresInSeconds: number;
    actor: ActorEntity;
    user: User;
  }> {
    this.logger.debug(`Login attempt for email: ${email}`);

    // Validate user credentials (throws if user not found or credentials invalid)
    const { user, actor } = await this.identityProviderService.validateUser(
      email,
      password,
    );

    // A session starts in the person's oldest workspace.
    const workspace = await this.entitlementsService.sessionEntitlement(
      actor.id,
      null,
    );

    // Generate access token using centralized config
    const config = getConfig();
    const durationMinutes = config.webAccessTokenDurationMinutes;
    const accessToken = await this.generateWebAccessToken(
      durationMinutes,
      actor,
      user,
      workspace,
    );

    // Generate refresh token (1 day expiration)
    const refreshToken = await this.generateAndStoreRefreshToken(
      user.id,
      workspace.workspaceId,
    );

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
   * Generate a signed JWT access token for web authentication, in one
   * workspace the person is a member of.
   */
  private async generateWebAccessToken(
    durationMinutes: number,
    actor: ActorEntity,
    user: User,
    workspace: Entitlement,
  ): Promise<string> {
    const now = Math.floor(Date.now() / 1000);
    const config = getConfig();

    const payload: AccessTokenClaims = {
      iss: config.issuerUrl,
      sub: actor.id,
      workspace_id: workspace.workspaceId,
      actor_id: actor.id,
      actor_slug: actor.slug,
      actor_type: actor.type,
      displayName: actor.displayName,
      email: user.email,
      // The workspace role decides `user:admin` and the workspace-settings
      // scopes; the installation role decides `installation:admin`
      // (docs/architecture/workspaces.md, "Entitlements").
      scope: this.entitlementsService.webSessionScopes(workspace, {
        operator: user.role === UserRole.ADMIN,
      }),
      aud: WEB_SESSION_AUDIENCE,
      client_id: 'web-app',
      resource: `${config.issuerUrl}`,
      version: '0.0.0',
      iat: now,
      exp: now + durationMinutes * 60,
      jti: randomBytes(16).toString('hex'),
    };

    return this.tokenSignerService.signToken(payload);
  }

  /**
   * Generate and store a refresh token in the database
   * Returns the unhashed token (to be sent to client)
   */
  private async generateAndStoreRefreshToken(
    userId: string,
    workspaceId: string,
  ): Promise<string> {
    // Generate a cryptographically secure random token
    const token = randomBytes(32).toString('base64url');

    // Hash the token before storing
    const tokenHash = createHash('sha256').update(token).digest('hex');

    // Calculate expiration based on centralized config
    const config = getConfig();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + config.webRefreshTokenDurationDays);

    // Store in database
    const refreshToken = this.refreshTokenRepository.create({
      userId,
      tokenHash,
      expiresAt,
      revokedAt: null,
      workspaceId,
    });

    await this.refreshTokenRepository.save(refreshToken);

    // Return the unhashed token
    return token;
  }

  /**
   * Web Authentication: Refresh access token using refresh token
   * Returns new access and refresh tokens
   */
  async refreshWebToken(refreshToken: string): Promise<{
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
    user: User;
    actor: ActorEntity;
  }> {
    this.logger.debug('Refresh token request');

    // Hash the provided refresh token to compare with stored hash
    const tokenHash = createHash('sha256').update(refreshToken).digest('hex');

    // Find the refresh token in database with user and actor relations
    const storedToken = await this.refreshTokenRepository.findOne({
      where: { tokenHash },
      relations: ['user', 'user.actor'],
    });

    if (!storedToken) {
      this.logger.warn('Refresh token not found');
      throw new UnauthorizedException('Invalid refresh token');
    }

    if (!storedToken.user) {
      this.logger.warn('Refresh token user missing');
      if (!storedToken.revokedAt) {
        storedToken.revokedAt = new Date();
        await this.refreshTokenRepository.save(storedToken);
      }
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
      this.logger.error(
        'User not found for refresh token. This should not happen',
      );
      throw new RefreshTokenUserMissingError(storedToken.id);
    }
    if (!user.isActive || this.identityProviderService.isPasswordSetupPending(user)) {
      throw new UnauthorizedException('Invalid refresh token');
    }
    const actor = storedToken.user.actor;
    if (!actor) {
      this.logger.error(
        'Actor not found for refresh token. This should not happen',
      );
      throw new RefreshTokenActorMissingError(storedToken.id);
    }

    // Stay in the session's workspace while still a member of it.
    const workspace = await this.entitlementsService.sessionEntitlement(
      actor.id,
      storedToken.workspaceId,
    );
    const refreshConfig = getConfig();
    const newAccessToken = await this.generateWebAccessToken(
      refreshConfig.webAccessTokenDurationMinutes,
      actor,
      user,
      workspace,
    );
    const newRefreshToken = await this.generateAndStoreRefreshToken(
      user.id,
      workspace.workspaceId,
    );

    this.logger.log(
      `Refresh token exchanged successfully for user: ${user.email}`,
    );

    return {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
      expiresIn: refreshConfig.webAccessTokenDurationMinutes * 60, // Convert minutes to seconds
      actor,
      user,
    };
  }

  /**
   * Mints a new session (access and refresh token) in another workspace the
   * person is a member of, and revokes the refresh token of the session it
   * replaces.
   *
   * @throws {NotInWorkspaceError} if they are not a member of it (404, so
   *   workspace ids cannot be probed)
   */
  async switchWorkspace(
    actorId: string,
    workspaceId: string,
    currentRefreshToken: string | undefined,
  ): Promise<{
    accessToken: string;
    refreshToken: string;
    expiresInSeconds: number;
    actor: ActorEntity;
    user: User;
  }> {
    const role = await this.entitlementsService.roleIn(workspaceId, actorId);
    if (!role) {
      throw new NotInWorkspaceError();
    }
    const actor = await this.actorService.getActorById(actorId, true);
    const user = actor?.user;
    if (
      !actor ||
      actor.deletedAt ||
      !user ||
      !user.isActive ||
      this.identityProviderService.isPasswordSetupPending(user)
    ) {
      throw new UnauthorizedException('Not authenticated');
    }

    if (currentRefreshToken) {
      const tokenHash = createHash('sha256')
        .update(currentRefreshToken)
        .digest('hex');
      await this.refreshTokenRepository.update(
        { tokenHash, userId: user.id, revokedAt: IsNull() },
        { revokedAt: new Date() },
      );
    }

    const config = getConfig();
    const durationMinutes = config.webAccessTokenDurationMinutes;
    const accessToken = await this.generateWebAccessToken(
      durationMinutes,
      actor,
      user,
      { workspaceId, role },
    );
    const refreshToken = await this.generateAndStoreRefreshToken(
      user.id,
      workspaceId,
    );
    this.logger.log(`User ${user.email} switched to workspace ${workspaceId}`);
    return {
      accessToken,
      refreshToken,
      expiresInSeconds: durationMinutes * 60,
      actor,
      user,
    };
  }
}
