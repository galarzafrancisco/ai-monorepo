jest.mock('@taico/errors', () => ({ ErrorCodes: {} }));

import { DataSource, EntityManager, Repository } from 'typeorm';
import { McpAuthorizationFlowEntity } from '../../auth-journeys/entities';
import { McpRefreshTokenEntity } from '../entities/mcp-refresh-token.entity';
import { RotateMcpRefreshTokenUseCase } from './rotate-mcp-refresh-token.use-case';

describe('RotateMcpRefreshTokenUseCase', () => {
  it('conditionally revokes the presented token and writes its successor in one transaction', async () => {
    const authFlow = Object.assign(new McpAuthorizationFlowEntity(), {
      id: 'flow-1',
    });
    const storedToken = Object.assign(new McpRefreshTokenEntity(), {
      id: 'token-1',
      mcpAuthorizationFlowId: authFlow.id,
      clientId: 'client-1',
      tokenHash: 'stored-hash',
      expiresAt: new Date(Date.now() + 60_000),
      revokedAt: null,
      mcpAuthorizationFlow: authFlow,
    });
    const repository = Object.create(
      Repository.prototype,
    ) as Repository<McpRefreshTokenEntity>;
    jest.spyOn(repository, 'findOne').mockResolvedValue(storedToken);
    jest
      .spyOn(repository, 'create')
      .mockImplementation((input) =>
        Object.assign(new McpRefreshTokenEntity(), input),
      );
    jest.spyOn(repository, 'save').mockResolvedValue(storedToken);
    const execute = jest.fn().mockResolvedValue({ affected: 1 });
    const queryBuilder = {
      update: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      execute,
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
    const useCase = new RotateMcpRefreshTokenUseCase(dataSource);

    const result = await useCase.execute('presented-token', 'client-1');

    expect(result.mcpAuthFlow).toBe(authFlow);
    expect(result.refreshToken).not.toBe('presented-token');
    expect(queryBuilder.andWhere).toHaveBeenCalledWith('revoked_at IS NULL');
    expect(repository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        mcpAuthorizationFlowId: authFlow.id,
        clientId: 'client-1',
        revokedAt: null,
      }),
    );
  });

  it('does not create a successor when another request already consumed the token', async () => {
    const authFlow = Object.assign(new McpAuthorizationFlowEntity(), {
      id: 'flow-1',
    });
    const storedToken = Object.assign(new McpRefreshTokenEntity(), {
      id: 'token-1',
      mcpAuthorizationFlowId: authFlow.id,
      clientId: 'client-1',
      expiresAt: new Date(Date.now() + 60_000),
      revokedAt: null,
      mcpAuthorizationFlow: authFlow,
    });
    const repository = Object.create(
      Repository.prototype,
    ) as Repository<McpRefreshTokenEntity>;
    jest.spyOn(repository, 'findOne').mockResolvedValue(storedToken);
    jest.spyOn(repository, 'save');
    const queryBuilder = {
      update: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      execute: jest.fn().mockResolvedValue({ affected: 0 }),
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
    const useCase = new RotateMcpRefreshTokenUseCase(dataSource);

    await expect(
      useCase.execute('presented-token', 'client-1'),
    ).rejects.toThrow('Refresh token has been revoked');

    expect(repository.save).not.toHaveBeenCalled();
  });
});
