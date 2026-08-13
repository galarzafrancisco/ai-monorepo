import { Injectable, UnauthorizedException } from '@nestjs/common';
import { createHash, randomBytes } from 'crypto';
import { DataSource } from 'typeorm';
import { getConfig } from '../../config/env.config';
import { ActorEntity } from '../../identity-provider/actor.entity';
import { IdentityProviderService } from '../../identity-provider/identity-provider.service';
import { User } from '../../identity-provider/user.entity';
import {
  RefreshTokenActorMissingError,
  RefreshTokenUserMissingError,
} from '../errors/web-auth.errors';
import { RefreshTokenEntity } from '../entities/refresh-token.entity';

export type RotatedWebRefreshToken = {
  refreshToken: string;
  user: User;
  actor: ActorEntity;
};

/** Atomically consumes a web refresh token and creates its successor. */
@Injectable()
export class RotateWebRefreshTokenUseCase {
  constructor(
    private readonly dataSource: DataSource,
    private readonly identityProviderService: IdentityProviderService,
  ) {}

  async execute(
    presentedRefreshToken: string,
  ): Promise<RotatedWebRefreshToken> {
    const tokenHash = createHash('sha256')
      .update(presentedRefreshToken)
      .digest('hex');
    const refreshToken = randomBytes(32).toString('base64url');
    const successorHash = createHash('sha256')
      .update(refreshToken)
      .digest('hex');
    const expiresAt = new Date();
    expiresAt.setDate(
      expiresAt.getDate() + getConfig().webRefreshTokenDurationDays,
    );

    return this.dataSource.transaction(async (manager) => {
      const repository = manager.getRepository(RefreshTokenEntity);
      const storedToken = await repository.findOne({
        where: { tokenHash },
        relations: ['user', 'user.actor'],
      });
      if (!storedToken)
        throw new UnauthorizedException('Invalid refresh token');
      if (storedToken.revokedAt)
        throw new UnauthorizedException('Refresh token revoked');
      if (new Date() > storedToken.expiresAt)
        throw new UnauthorizedException('Refresh token expired');
      if (!storedToken.user)
        throw new RefreshTokenUserMissingError(storedToken.id);
      if (
        !storedToken.user.isActive ||
        this.identityProviderService.isPasswordSetupPending(storedToken.user)
      ) {
        throw new UnauthorizedException('Invalid refresh token');
      }
      if (!storedToken.user.actor)
        throw new RefreshTokenActorMissingError(storedToken.id);

      const result = await repository
        .createQueryBuilder()
        .update(RefreshTokenEntity)
        .set({ revokedAt: new Date() })
        .where('id = :id', { id: storedToken.id })
        .andWhere('revoked_at IS NULL')
        .execute();
      if (result.affected !== 1)
        throw new UnauthorizedException('Refresh token revoked');

      await repository.save(
        repository.create({
          userId: storedToken.userId,
          tokenHash: successorHash,
          expiresAt,
          revokedAt: null,
        }),
      );
      return {
        refreshToken,
        user: storedToken.user,
        actor: storedToken.user.actor,
      };
    });
  }
}
