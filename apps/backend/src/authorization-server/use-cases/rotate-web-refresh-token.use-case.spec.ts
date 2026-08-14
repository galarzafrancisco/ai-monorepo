jest.mock('@taico/errors', () => ({ ErrorCodes: {} }));

import { DataSource, EntityManager, Repository } from 'typeorm';
import { ActorEntity } from '../../identity-provider/actor.entity';
import { IdentityProviderService } from '../../identity-provider/identity-provider.service';
import { User } from '../../identity-provider/user.entity';
import { RefreshTokenEntity } from '../entities/refresh-token.entity';
import { InvalidWebRefreshTokenError } from '../errors/web-auth.errors';
import { RotateWebRefreshTokenUseCase } from './rotate-web-refresh-token.use-case';

describe('RotateWebRefreshTokenUseCase', () => {
  it('throws a web-auth domain error for an unknown refresh token', async () => {
    const repository = Object.create(
      Repository.prototype,
    ) as Repository<RefreshTokenEntity>;
    jest.spyOn(repository, 'findOne').mockResolvedValue(null);
    const manager = Object.create(EntityManager.prototype) as EntityManager;
    Object.defineProperty(manager, 'getRepository', {
      value: () => repository,
    });
    const dataSource = Object.create(DataSource.prototype) as DataSource;
    Object.defineProperty(dataSource, 'transaction', {
      value: jest.fn(
        async (
          callback: (transactionManager: EntityManager) => Promise<unknown>,
        ) => callback(manager),
      ),
    });
    const identityProvider = Object.create(
      IdentityProviderService.prototype,
    ) as IdentityProviderService;
    const useCase = new RotateWebRefreshTokenUseCase(
      dataSource,
      identityProvider,
    );

    await expect(useCase.execute('unknown-token')).rejects.toBeInstanceOf(
      InvalidWebRefreshTokenError,
    );
  });

  it('validates the user then conditionally revokes and replaces the token in one transaction', async () => {
    const actor = Object.assign(new ActorEntity(), { id: 'actor-1' });
    const user = Object.assign(new User(), {
      id: 'user-1',
      isActive: true,
      actor,
    });
    const storedToken = Object.assign(new RefreshTokenEntity(), {
      id: 'token-1',
      userId: user.id,
      expiresAt: new Date(Date.now() + 60_000),
      revokedAt: null,
      user,
    });
    const repository = Object.create(
      Repository.prototype,
    ) as Repository<RefreshTokenEntity>;
    jest.spyOn(repository, 'findOne').mockResolvedValue(storedToken);
    jest
      .spyOn(repository, 'create')
      .mockImplementation((input) =>
        Object.assign(new RefreshTokenEntity(), input),
      );
    jest.spyOn(repository, 'save').mockResolvedValue(storedToken);
    const queryBuilder = {
      update: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      execute: jest.fn().mockResolvedValue({ affected: 1 }),
    };
    Object.defineProperty(repository, 'createQueryBuilder', {
      value: jest.fn(() => queryBuilder),
    });
    const manager = Object.create(EntityManager.prototype) as EntityManager;
    Object.defineProperty(manager, 'getRepository', {
      value: () => repository,
    });
    const dataSource = Object.create(DataSource.prototype) as DataSource;
    Object.defineProperty(dataSource, 'transaction', {
      value: jest.fn(
        async (
          callback: (transactionManager: EntityManager) => Promise<unknown>,
        ) => callback(manager),
      ),
    });
    const identityProvider = Object.create(
      IdentityProviderService.prototype,
    ) as IdentityProviderService;
    jest
      .spyOn(identityProvider, 'isPasswordSetupPending')
      .mockReturnValue(false);
    const useCase = new RotateWebRefreshTokenUseCase(
      dataSource,
      identityProvider,
    );

    const result = await useCase.execute('presented-token');

    expect(result.user).toBe(user);
    expect(result.actor).toBe(actor);
    expect(queryBuilder.andWhere).toHaveBeenCalledWith('revoked_at IS NULL');
    expect(repository.save).toHaveBeenCalledWith(
      expect.objectContaining({ userId: user.id, revokedAt: null }),
    );
  });
});
