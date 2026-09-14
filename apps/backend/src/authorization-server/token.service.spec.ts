import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

jest.mock('../auth-journeys/auth-journeys.service', () => ({
  AuthJourneysService: class AuthJourneysService {},
}));

jest.mock('../auth/crypto/token-verifier.service', () => ({
  TokenVerifierService: class TokenVerifierService {},
}));

jest.mock('../auth/crypto/token-signer.service', () => ({
  TokenSignerService: class TokenSignerService {},
}));

jest.mock('./errors/token.errors', () => {
  class TokenTestError extends Error {}

  return {
    InvalidGrantTypeError: TokenTestError,
    MissingRequiredParametersError: TokenTestError,
    InvalidAuthorizationCodeError: TokenTestError,
    ClientIdMismatchError: TokenTestError,
    AuthorizationCodeUsedError: TokenTestError,
    AuthorizationCodeExpiredError: TokenTestError,
    RedirectUriMismatchError: TokenTestError,
    MissingPkceParametersError: TokenTestError,
    InvalidCodeVerifierError: TokenTestError,
    InvalidRefreshTokenError: TokenTestError,
    RefreshTokenExpiredError: TokenTestError,
    RefreshTokenRevokedError: TokenTestError,
  };
});

import { TokenService } from './token.service';
import { AuthJourneysService } from '../auth-journeys/auth-journeys.service';
import { TokenVerifierService } from '../auth/crypto/token-verifier.service';
import { TokenSignerService } from '../auth/crypto/token-signer.service';
import { McpRefreshTokenEntity } from './entities/mcp-refresh-token.entity';
import { GrantType } from './enums/grant-type.enum';
import { McpAuthorizationFlowEntity } from '../auth-journeys/entities';
import { ActorType } from 'src/identity-provider/enums';
import { AccessTokenClaims } from 'src/auth/core/types/access-token-claims.type';
import { createHash } from 'crypto';

describe('TokenService', () => {
  let service: TokenService;
  let authJourneysService: jest.Mocked<AuthJourneysService>;
  let tokenSignerService: jest.Mocked<TokenSignerService>;
  let refreshTokenRepository: jest.Mocked<Repository<McpRefreshTokenEntity>>;
  let signedClaims: AccessTokenClaims[];

  const codeVerifier = 'plain-code-verifier-with-enough-length-1234567890';

  const mcpAuthFlow = {
    id: 'mcp-flow-uuid',
    authorizationJourneyId: 'journey-uuid',
    authorizationCode: 'authorization-code',
    authorizationCodeUsed: false,
    authorizationCodeExpiresAt: new Date(Date.now() + 3600000),
    codeChallenge: codeVerifier,
    codeChallengeMethod: 'plain',
    redirectUri: 'http://localhost:6274/oauth/callback/debug',
    resource: 'resource-uri',
    scopes: ['tasks:read'],
    client: {
      clientId: 'registered-client-id',
      scopes: ['tasks:read'],
    },
    server: {
      providedId: 'test-server',
    },
    authJourney: {
      actorId: 'actor-uuid',
      actor: {
        id: 'actor-uuid',
        slug: 'actor',
        type: ActorType.HUMAN,
        displayName: 'Test Actor',
        user: {
          email: 'actor@example.com',
        },
      },
    },
  } as McpAuthorizationFlowEntity;

  beforeEach(async () => {
    signedClaims = [];

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TokenService,
        {
          provide: AuthJourneysService,
          useValue: {
            findMcpAuthFlowByAuthorizationCode: jest.fn(),
            saveMcpAuthFlow: jest.fn(),
            updateAuthJourneyStatus: jest.fn(),
          },
        },
        {
          provide: TokenVerifierService,
          useValue: {
            verifyAndDecode: jest.fn(),
          },
        },
        {
          provide: TokenSignerService,
          useValue: {
            signToken: jest.fn().mockImplementation(async (claims) => {
              signedClaims.push(claims);
              return 'signed-access-token';
            }),
          },
        },
        {
          provide: getRepositoryToken(McpRefreshTokenEntity),
          useValue: {
            create: jest.fn().mockImplementation((value) => value),
            save: jest.fn().mockImplementation(async (value) => value),
            findOne: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get(TokenService);
    authJourneysService = module.get(AuthJourneysService);
    tokenSignerService = module.get(TokenSignerService);
    refreshTokenRepository = module.get(
      getRepositoryToken(McpRefreshTokenEntity),
    );
  });

  it('includes grant-binding claims in authorization-code access tokens', async () => {
    authJourneysService.findMcpAuthFlowByAuthorizationCode.mockResolvedValue({
      ...mcpAuthFlow,
    });

    await service.handleTokenRequest({
      grant_type: GrantType.AUTHORIZATION_CODE,
      client_id: 'registered-client-id',
      code: 'authorization-code',
      redirect_uri: 'http://localhost:6274/oauth/callback/debug',
      code_verifier: codeVerifier,
    });

    expect(tokenSignerService.signToken).toHaveBeenCalledTimes(1);
    expect(signedClaims[0]).toMatchObject({
      authorization_journey_id: 'journey-uuid',
      mcp_authorization_flow_id: 'mcp-flow-uuid',
    });
  });

  it('preserves grant-binding claims in refresh-token access tokens', async () => {
    const refreshToken = 'refresh-token';
    refreshTokenRepository.findOne.mockResolvedValue({
      tokenHash: createHash('sha256').update(refreshToken).digest('hex'),
      clientId: 'registered-client-id',
      expiresAt: new Date(Date.now() + 3600000),
      revokedAt: null,
      mcpAuthorizationFlow: {
        ...mcpAuthFlow,
      },
    } as McpRefreshTokenEntity);

    await service.handleTokenRequest({
      grant_type: GrantType.REFRESH_TOKEN,
      client_id: 'registered-client-id',
      refresh_token: refreshToken,
    });

    expect(tokenSignerService.signToken).toHaveBeenCalledTimes(1);
    expect(signedClaims[0]).toMatchObject({
      authorization_journey_id: 'journey-uuid',
      mcp_authorization_flow_id: 'mcp-flow-uuid',
    });
  });
});
