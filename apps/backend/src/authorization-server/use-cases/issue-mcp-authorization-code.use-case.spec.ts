jest.mock('@taico/errors', () => ({ ErrorCodes: {} }));

import { DataSource, EntityManager, Repository } from 'typeorm';
import { AuthJourneyEntity } from '../../auth-journeys/entities/auth-journey.entity';
import { McpAuthorizationFlowEntity } from '../../auth-journeys/entities/mcp-authorization-flow.entity';
import { IssueMcpAuthorizationCodeUseCase } from './issue-mcp-authorization-code.use-case';

describe('IssueMcpAuthorizationCodeUseCase', () => {
  it('conditionally issues a single code and advances the journey in one transaction', async () => {
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
    const useCase = new IssueMcpAuthorizationCodeUseCase(dataSource);

    const code = await useCase.execute('flow-1', 'journey-1');

    expect(code).toBeTruthy();
    expect(queryBuilder.andWhere).toHaveBeenCalledWith(
      'authorization_code IS NULL',
    );
    expect(journeyRepository.update).toHaveBeenCalledWith(
      { id: 'journey-1' },
      expect.objectContaining({ status: 'authorization_code_issued' }),
    );
  });
});
