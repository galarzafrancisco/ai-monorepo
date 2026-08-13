jest.mock('@taico/errors', () => ({ ErrorCodes: {} }));

import { DataSource, EntityManager, Repository } from 'typeorm';
import { AuthJourneyEntity } from '../../auth-journeys/entities/auth-journey.entity';
import { ConnectionAuthorizationFlowEntity } from '../../auth-journeys/entities/connection-authorization-flow.entity';
import { McpAuthorizationFlowEntity } from '../../auth-journeys/entities/mcp-authorization-flow.entity';
import { GrantType, TokenEndpointAuthMethod } from '../enums';
import { RegisterClientDto } from '../dto/register-client.dto';
import { RegisteredClientEntity } from '../entities/registered-client.entity';
import { RegisterClientUseCase } from './register-client.use-case';

describe('RegisterClientUseCase', () => {
  it('persists client, journey, MCP flow, and connection flows in one transaction', async () => {
    const dto = Object.assign(new RegisterClientDto(), {
      client_name: 'Client',
      redirect_uris: ['https://client.example/callback'],
      grant_types: [GrantType.AUTHORIZATION_CODE, GrantType.REFRESH_TOKEN],
      token_endpoint_auth_method: TokenEndpointAuthMethod.NONE,
    });
    const client = Object.assign(new RegisteredClientEntity(), {
      id: 'client-1',
    });
    const journey = Object.assign(new AuthJourneyEntity(), { id: 'journey-1' });
    const clientRepository = Object.create(
      Repository.prototype,
    ) as Repository<RegisteredClientEntity>;
    jest
      .spyOn(clientRepository, 'create')
      .mockImplementation((input) =>
        Object.assign(new RegisteredClientEntity(), input),
      );
    jest.spyOn(clientRepository, 'save').mockResolvedValue(client);
    const journeyRepository = Object.create(
      Repository.prototype,
    ) as Repository<AuthJourneyEntity>;
    jest
      .spyOn(journeyRepository, 'create')
      .mockImplementation((input) =>
        Object.assign(new AuthJourneyEntity(), input),
      );
    jest.spyOn(journeyRepository, 'save').mockResolvedValue(journey);
    const mcpFlowRepository = Object.create(
      Repository.prototype,
    ) as Repository<McpAuthorizationFlowEntity>;
    jest
      .spyOn(mcpFlowRepository, 'create')
      .mockImplementation((input) =>
        Object.assign(new McpAuthorizationFlowEntity(), input),
      );
    jest
      .spyOn(mcpFlowRepository, 'save')
      .mockResolvedValue(
        Object.assign(new McpAuthorizationFlowEntity(), { id: 'flow-1' }),
      );
    const connectionFlowRepository = Object.create(
      Repository.prototype,
    ) as Repository<ConnectionAuthorizationFlowEntity>;
    jest
      .spyOn(connectionFlowRepository, 'create')
      .mockImplementation((input) =>
        Object.assign(new ConnectionAuthorizationFlowEntity(), input),
      );
    Object.defineProperty(connectionFlowRepository, 'save', {
      value: jest.fn().mockResolvedValue([]),
    });
    const manager = Object.create(EntityManager.prototype) as EntityManager;
    Object.defineProperty(manager, 'getRepository', {
      value: (entity: unknown) => {
        if (entity === RegisteredClientEntity) return clientRepository;
        if (entity === AuthJourneyEntity) return journeyRepository;
        if (entity === McpAuthorizationFlowEntity) return mcpFlowRepository;
        return connectionFlowRepository;
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
    const useCase = new RegisterClientUseCase(dataSource);

    await useCase.execute({
      dto,
      clientId: 'client-public-id',
      clientSecretHash: null,
      scopes: [],
      server: { id: 'server-1', connections: [{ id: 'connection-1' }] },
    });

    expect(clientRepository.save).toHaveBeenCalled();
    expect(journeyRepository.save).toHaveBeenCalled();
    expect(mcpFlowRepository.save).toHaveBeenCalled();
    expect(connectionFlowRepository.save).toHaveBeenCalledWith([
      expect.objectContaining({
        authorizationJourneyId: journey.id,
        mcpConnectionId: 'connection-1',
      }),
    ]);
  });
});
