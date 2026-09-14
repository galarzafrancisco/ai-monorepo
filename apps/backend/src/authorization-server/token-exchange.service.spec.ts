import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { Repository } from 'typeorm';

jest.mock('../mcp-registry/mcp-registry.service', () => ({
  McpRegistryService: class McpRegistryService {},
}));

jest.mock('src/auth/crypto/token-verifier.service', () => ({
  TokenVerifierService: class TokenVerifierService {},
}));

import { TokenExchangeService } from './token-exchange.service';
import { McpConnectionEntity } from '../mcp-registry/entities/mcp-connection.entity';
import { McpScopeMappingEntity } from '../mcp-registry/entities/mcp-scope-mapping.entity';
import { ConnectionAuthorizationFlowEntity } from '../auth-journeys/entities/connection-authorization-flow.entity';
import { TokenExchangeRequestDto } from './dto/token-exchange-request.dto';
import { ConnectionAuthorizationFlowStatus } from 'src/auth-journeys/enums/connection-authorization-flow-status.enum';
import { McpRegistryService } from '../mcp-registry/mcp-registry.service';
import { TokenVerifierService } from 'src/auth/crypto/token-verifier.service';
import { AccessTokenClaims } from 'src/auth/core/types/access-token-claims.type';
import { ActorType } from 'src/identity-provider/enums';

describe('TokenExchangeService', () => {
  let service: TokenExchangeService;
  let mcpConnectionRepository: jest.Mocked<Repository<McpConnectionEntity>>;
  let mcpScopeMappingRepository: jest.Mocked<Repository<McpScopeMappingEntity>>;
  let connectionAuthorizationFlowRepository: jest.Mocked<
    Repository<ConnectionAuthorizationFlowEntity>
  >;
  let mcpRegistryService: jest.Mocked<McpRegistryService>;
  let tokenVerifierService: jest.Mocked<TokenVerifierService>;
  let queryBuilder: {
    innerJoin: jest.Mock;
    where: jest.Mock;
    andWhere: jest.Mock;
    take: jest.Mock;
    getMany: jest.Mock;
  };

  const mockConnection: McpConnectionEntity = {
    id: 'connection-uuid',
    serverId: 'server-uuid',
    friendlyName: 'Test Connection',
    providedId: 'test-connection',
    clientId: 'downstream-client-id',
    clientSecret: 'downstream-client-secret',
    authorizeUrl: 'https://example.com/authorize',
    tokenUrl: 'https://example.com/token',
    createdAt: new Date(),
    updatedAt: new Date(),
  } as McpConnectionEntity;

  const mockClaims: AccessTokenClaims = {
    iss: 'https://issuer.example.com',
    sub: 'actor-uuid',
    actor_id: 'actor-uuid',
    actor_slug: 'actor',
    actor_type: ActorType.HUMAN,
    aud: 'test-server',
    exp: Math.floor(Date.now() / 1000) + 3600,
    iat: Math.floor(Date.now() / 1000),
    jti: 'token-id',
    client_id: 'registered-client-id',
    authorization_journey_id: 'journey-uuid',
    mcp_authorization_flow_id: 'mcp-flow-uuid',
    scope: ['tasks:read'],
    mcp_server_identifier: 'test-server',
    resource: 'resource-uri',
    version: '1.0.0',
  };

  const mockAuthFlow: ConnectionAuthorizationFlowEntity = {
    id: 'flow-uuid',
    authorizationJourneyId: 'journey-uuid',
    mcpConnectionId: 'connection-uuid',
    status: ConnectionAuthorizationFlowStatus.AUTHORIZED,
    accessToken: 'downstream-access-token',
    refreshToken: 'downstream-refresh-token',
    tokenExpiresAt: new Date(Date.now() + 3600000),
    createdAt: new Date(),
    updatedAt: new Date(),
  } as ConnectionAuthorizationFlowEntity;

  const request: TokenExchangeRequestDto = {
    grant_type: 'urn:ietf:params:oauth:grant-type:token-exchange',
    subject_token: 'mcp-jwt',
    subject_token_type: 'urn:ietf:params:oauth:token-type:access_token',
    resource: 'test-connection',
    scope: 'downstream.scope',
  };

  beforeEach(async () => {
    queryBuilder = {
      innerJoin: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([mockAuthFlow]),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TokenExchangeService,
        {
          provide: getRepositoryToken(McpConnectionEntity),
          useValue: {
            findOne: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(McpScopeMappingEntity),
          useValue: {
            find: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(ConnectionAuthorizationFlowEntity),
          useValue: {
            createQueryBuilder: jest.fn().mockReturnValue(queryBuilder),
            save: jest.fn(),
          },
        },
        {
          provide: McpRegistryService,
          useValue: {
            resolveServerIdFromProvidedId: jest.fn(),
          },
        },
        {
          provide: TokenVerifierService,
          useValue: {
            verifyAndDecode: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<TokenExchangeService>(TokenExchangeService);
    mcpConnectionRepository = module.get(
      getRepositoryToken(McpConnectionEntity),
    );
    mcpScopeMappingRepository = module.get(
      getRepositoryToken(McpScopeMappingEntity),
    );
    connectionAuthorizationFlowRepository = module.get(
      getRepositoryToken(ConnectionAuthorizationFlowEntity),
    );
    mcpRegistryService = module.get(McpRegistryService);
    tokenVerifierService = module.get(TokenVerifierService);

    mcpRegistryService.resolveServerIdFromProvidedId.mockResolvedValue(
      'server-uuid',
    );
    tokenVerifierService.verifyAndDecode.mockResolvedValue(mockClaims);
    mcpConnectionRepository.findOne.mockResolvedValue(mockConnection);
    mcpScopeMappingRepository.find.mockResolvedValue([
      {
        id: 'mapping-1',
        scopeId: 'tasks:read',
        connectionId: 'connection-uuid',
        serverId: 'server-uuid',
        downstreamScope: 'downstream.scope',
      } as McpScopeMappingEntity,
    ]);
  });

  it('returns a downstream token when connection and grant bindings match', async () => {
    const result = await service.exchangeToken(request, 'test-server');

    expect(result.access_token).toBe('downstream-access-token');
    expect(queryBuilder.getMany).toHaveBeenCalledTimes(1);
    expect(queryBuilder.andWhere).toHaveBeenCalledWith(
      'connectionFlow.authorizationJourneyId = :authorizationJourneyId',
      { authorizationJourneyId: 'journey-uuid' },
    );
    expect(queryBuilder.andWhere).toHaveBeenCalledWith(
      'authJourney.actorId = :actorId',
      { actorId: 'actor-uuid' },
    );
    expect(queryBuilder.andWhere).toHaveBeenCalledWith(
      'mcpFlow.id = :mcpAuthorizationFlowId',
      { mcpAuthorizationFlowId: 'mcp-flow-uuid' },
    );
    expect(queryBuilder.andWhere).toHaveBeenCalledWith(
      'client.clientId = :clientId',
      { clientId: 'registered-client-id' },
    );
    expect(queryBuilder.andWhere).toHaveBeenCalledWith(
      'mcpFlow.resource = :resource',
      { resource: 'resource-uri' },
    );
    expect(queryBuilder.andWhere).toHaveBeenCalledWith(
      'server.providedId = :serverIdentifier',
      { serverIdentifier: 'test-server' },
    );
    expect(queryBuilder.take).toHaveBeenCalledWith(2);
  });

  it.each([
    [
      'different actor',
      { sub: 'other-actor' },
      'authJourney.actorId = :actorId',
      { actorId: 'other-actor' },
    ],
    [
      'different client',
      { client_id: 'other-client' },
      'client.clientId = :clientId',
      { clientId: 'other-client' },
    ],
    [
      'different authorization journey',
      { authorization_journey_id: 'other-journey' },
      'connectionFlow.authorizationJourneyId = :authorizationJourneyId',
      { authorizationJourneyId: 'other-journey' },
    ],
    [
      'different MCP authorization flow',
      { mcp_authorization_flow_id: 'other-flow' },
      'mcpFlow.id = :mcpAuthorizationFlowId',
      { mcpAuthorizationFlowId: 'other-flow' },
    ],
    [
      'different resource',
      { resource: 'other-resource' },
      'mcpFlow.resource = :resource',
      { resource: 'other-resource' },
    ],
  ])(
    'rejects when the only downstream grant has a %s',
    async (_label, claimPatch, predicate, params) => {
      tokenVerifierService.verifyAndDecode.mockResolvedValue({
        ...mockClaims,
        ...claimPatch,
      });
      queryBuilder.getMany.mockResolvedValue([]);

      await expect(
        service.exchangeToken(request, 'test-server'),
      ).rejects.toThrow(UnauthorizedException);
      expect(queryBuilder.andWhere).toHaveBeenCalledWith(predicate, params);
    },
  );

  it('rejects when no bound downstream flow matches', async () => {
    queryBuilder.getMany.mockResolvedValue([]);

    await expect(service.exchangeToken(request, 'test-server')).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('rejects ambiguous downstream grant matches', async () => {
    queryBuilder.getMany.mockResolvedValue([mockAuthFlow, mockAuthFlow]);

    await expect(service.exchangeToken(request, 'test-server')).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('refreshes only after selecting the bound downstream flow', async () => {
    const expiringAuthFlow = {
      ...mockAuthFlow,
      tokenExpiresAt: new Date(Date.now() + 60 * 1000),
    } as ConnectionAuthorizationFlowEntity;
    const fetchMock = jest.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        access_token: 'refreshed-downstream-access-token',
        expires_in: 3600,
      }),
    } as Response);
    queryBuilder.getMany.mockResolvedValue([expiringAuthFlow]);

    const result = await service.exchangeToken(request, 'test-server');

    expect(result.access_token).toBe('refreshed-downstream-access-token');
    expect(connectionAuthorizationFlowRepository.save).toHaveBeenCalledWith(
      expiringAuthFlow,
    );
    expect(expiringAuthFlow.accessToken).toBe(
      'refreshed-downstream-access-token',
    );

    fetchMock.mockRestore();
  });

  it('rejects tokens missing grant-binding claims', async () => {
    tokenVerifierService.verifyAndDecode.mockResolvedValue({
      ...mockClaims,
      authorization_journey_id: undefined,
    });

    await expect(service.exchangeToken(request, 'test-server')).rejects.toThrow(
      UnauthorizedException,
    );
    expect(
      connectionAuthorizationFlowRepository.createQueryBuilder,
    ).not.toHaveBeenCalled();
  });

  it('rejects array audiences even when they include the expected server', async () => {
    tokenVerifierService.verifyAndDecode.mockResolvedValue({
      ...mockClaims,
      aud: ['test-server'],
    });

    await expect(service.exchangeToken(request, 'test-server')).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('throws ForbiddenException when requested scope is not entitled', async () => {
    await expect(
      service.exchangeToken(
        { ...request, scope: 'other.scope' },
        'test-server',
      ),
    ).rejects.toThrow(ForbiddenException);
  });
});
