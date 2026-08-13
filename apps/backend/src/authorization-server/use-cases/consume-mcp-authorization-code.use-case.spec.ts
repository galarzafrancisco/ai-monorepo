jest.mock('@taico/errors', () => ({ ErrorCodes: {} }));

import { DataSource, EntityManager, Repository } from 'typeorm';
import { AuthJourneyEntity } from '../../auth-journeys/entities/auth-journey.entity';
import { McpAuthorizationFlowEntity } from '../../auth-journeys/entities/mcp-authorization-flow.entity';
import { McpRefreshTokenEntity } from '../entities/mcp-refresh-token.entity';
import { ConsumeMcpAuthorizationCodeUseCase } from './consume-mcp-authorization-code.use-case';

describe('ConsumeMcpAuthorizationCodeUseCase', () => {
  it('consumes the code, advances its journey, and stores a refresh token in one transaction', async () => {
    const flow = Object.assign(new McpAuthorizationFlowEntity(), {
      id: 'flow-1',
      authorizationJourneyId: 'journey-1',
    });
    const flowRepository = Object.create(
      Repository.prototype,
    ) as Repository<McpAuthorizationFlowEntity>;
    const flowQueryBuilder = {
      update: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      execute: jest.fn().mockResolvedValue({ affected: 1 }),
    };
    Object.defineProperty(flowRepository, 'createQueryBuilder', {
      value: jest.fn(() => flowQueryBuilder),
    });
    const journeyRepository = Object.create(
      Repository.prototype,
    ) as Repository<AuthJourneyEntity>;
    jest.spyOn(journeyRepository, 'update').mockResolvedValue({
      affected: 1,
      generatedMaps: [],
      raw: [],
    });
    const refreshRepository = Object.create(
      Repository.prototype,
    ) as Repository<McpRefreshTokenEntity>;
    jest
      .spyOn(refreshRepository, 'create')
      .mockImplementation((input) =>
        Object.assign(new McpRefreshTokenEntity(), input),
      );
    jest
      .spyOn(refreshRepository, 'save')
      .mockResolvedValue(
        Object.assign(new McpRefreshTokenEntity(), { id: 'token-1' }),
      );
    const manager = Object.create(EntityManager.prototype) as EntityManager;
    Object.defineProperty(manager, 'getRepository', {
      value: (entity: unknown) => {
        if (entity === McpAuthorizationFlowEntity) return flowRepository;
        if (entity === AuthJourneyEntity) return journeyRepository;
        return refreshRepository;
      },
    });
    const dataSource = Object.create(DataSource.prototype) as DataSource;
    Object.defineProperty(dataSource, 'transaction', {
      value: jest.fn(
        async (
          callback: (transactionManager: EntityManager) => Promise<unknown>,
        ) => callback(manager),
      ),
    });
    const useCase = new ConsumeMcpAuthorizationCodeUseCase(dataSource);

    const refreshToken = await useCase.execute(flow, 'client-1');

    expect(refreshToken).toBeTruthy();
    expect(flowQueryBuilder.andWhere).toHaveBeenCalledWith(
      'authorization_code_used = 0',
    );
    expect(journeyRepository.update).toHaveBeenCalledWith(
      { id: flow.authorizationJourneyId },
      expect.objectContaining({ status: 'authorization_code_exchanged' }),
    );
    expect(refreshRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        mcpAuthorizationFlowId: flow.id,
        clientId: 'client-1',
        revokedAt: null,
      }),
    );
  });
});
