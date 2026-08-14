jest.mock('@taico/errors', () => ({ ErrorCodes: {} }));

import { DataSource, EntityManager, Repository } from 'typeorm';
import { AuthJourneyEntity } from '../../auth-journeys/entities/auth-journey.entity';
import { McpAuthorizationFlowEntity } from '../../auth-journeys/entities/mcp-authorization-flow.entity';
import { StartMcpAuthorizationRequestUseCase } from './start-mcp-authorization-request.use-case';

describe('StartMcpAuthorizationRequestUseCase', () => {
  it('stores PKCE/request fields and advances the journey in one transaction', async () => {
    const flowRepository = Object.create(
      Repository.prototype,
    ) as Repository<McpAuthorizationFlowEntity>;
    const queryBuilder = {
      update: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      execute: jest.fn().mockResolvedValue({ affected: 1 }),
    };
    Object.defineProperty(flowRepository, 'createQueryBuilder', {
      value: jest.fn(() => queryBuilder),
    });
    const journeyRepository = Object.create(
      Repository.prototype,
    ) as Repository<AuthJourneyEntity>;
    jest.spyOn(journeyRepository, 'update').mockResolvedValue({
      affected: 1,
      generatedMaps: [],
      raw: [],
    });
    const manager = Object.create(EntityManager.prototype) as EntityManager;
    Object.defineProperty(manager, 'getRepository', {
      value: (entity: unknown) =>
        entity === McpAuthorizationFlowEntity
          ? flowRepository
          : journeyRepository,
    });
    const dataSource = Object.create(DataSource.prototype) as DataSource;
    Object.defineProperty(dataSource, 'transaction', {
      value: jest.fn(
        async (
          callback: (transactionManager: EntityManager) => Promise<unknown>,
        ) => callback(manager),
      ),
    });
    const useCase = new StartMcpAuthorizationRequestUseCase(dataSource);

    await useCase.execute({
      flowId: 'flow-1',
      journeyId: 'journey-1',
      codeChallenge: 'challenge',
      codeChallengeMethod: 'S256',
      state: 'state',
      redirectUri: 'https://client.example/callback',
      scopes: ['tasks:read'],
    });

    expect(queryBuilder.andWhere).toHaveBeenCalledWith(
      'authorization_code IS NULL',
    );
    expect(queryBuilder.set).toHaveBeenCalledWith(
      expect.objectContaining({
        codeChallenge: 'challenge',
        redirectUri: 'https://client.example/callback',
      }),
    );
    expect(journeyRepository.update).toHaveBeenCalled();
  });
});
