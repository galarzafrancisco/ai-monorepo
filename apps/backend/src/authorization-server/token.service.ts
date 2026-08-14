import { Injectable, Logger } from '@nestjs/common';
import { createHash, randomBytes } from 'crypto';
import { McpAuthorizationFlowEntity } from '../auth-journeys/entities';
import { AuthJourneysService } from '../auth-journeys/auth-journeys.service';
import { TokenRequestDto } from './dto/token-request.dto';
import { TokenResponseDto } from './dto/token-response.dto';
import {
  IntrospectTokenInput,
  IntrospectTokenResult,
} from './dto/service/token.service.types';
import { GrantType } from './enums/grant-type.enum';
import { TokenType } from './enums/token-type.enum';
import { getConfig } from '../config/env.config';
import {
  InvalidGrantTypeError,
  MissingRequiredParametersError,
  InvalidAuthorizationCodeError,
  ClientIdMismatchError,
  AuthorizationCodeUsedError,
  AuthorizationCodeExpiredError,
  RedirectUriMismatchError,
  MissingPkceParametersError,
  InvalidCodeVerifierError,
} from './errors/token.errors';
import { TokenVerifierService } from '../auth/crypto/token-verifier.service';
import { AccessTokenClaims } from '../auth/core/types/access-token-claims.type';
import { TokenSignerService } from '../auth/crypto/token-signer.service';
import { RotateMcpRefreshTokenUseCase } from './use-cases/rotate-mcp-refresh-token.use-case';
import { ConsumeMcpAuthorizationCodeUseCase } from './use-cases/consume-mcp-authorization-code.use-case';

@Injectable()
export class TokenService {
  private readonly logger = new Logger(TokenService.name);

  constructor(
    private readonly authJourneysService: AuthJourneysService,
    private readonly tokenVerifierService: TokenVerifierService,
    private readonly tokenSignerService: TokenSignerService,
    private readonly rotateMcpRefreshTokenUseCase: RotateMcpRefreshTokenUseCase,
    private readonly consumeMcpAuthorizationCodeUseCase: ConsumeMcpAuthorizationCodeUseCase,
  ) {}

  /**
   * Handle OAuth 2.0 token requests.
   * Routes to appropriate handler based on grant_type.
   */
  async handleTokenRequest(
    tokenRequest: TokenRequestDto,
  ): Promise<TokenResponseDto> {
    this.logger.debug(
      `Processing token request for client: ${tokenRequest.client_id}, grant_type: ${tokenRequest.grant_type}`,
    );

    switch (tokenRequest.grant_type) {
      case GrantType.AUTHORIZATION_CODE:
        return this.handleAuthorizationCodeGrant(tokenRequest);
      case GrantType.REFRESH_TOKEN:
        return this.handleRefreshTokenGrant(tokenRequest);
      default:
        throw new InvalidGrantTypeError(tokenRequest.grant_type);
    }
  }

  /**
   * Exchange authorization code for access token
   * Implements OAuth 2.0 authorization code grant with PKCE validation
   * @deprecated Use handleTokenRequest instead
   */
  async exchangeAuthorizationCode(
    tokenRequest: TokenRequestDto,
  ): Promise<TokenResponseDto> {
    return this.handleTokenRequest(tokenRequest);
  }

  /**
   * Handle authorization_code grant type
   */
  private async handleAuthorizationCodeGrant(
    tokenRequest: TokenRequestDto,
  ): Promise<TokenResponseDto> {
    // Validate required parameters
    if (
      !tokenRequest.code ||
      !tokenRequest.code_verifier ||
      !tokenRequest.redirect_uri
    ) {
      throw new MissingRequiredParametersError(tokenRequest.grant_type);
    }

    // Find the authorization flow by authorization code
    const mcpAuthFlow =
      await this.authJourneysService.findMcpAuthFlowByAuthorizationCode(
        tokenRequest.code,
        [
          'client',
          'server',
          'authJourney',
          'authJourney.actor',
          'authJourney.actor.user',
        ],
      );

    if (!mcpAuthFlow) {
      this.logger.warn(`Authorization code not found: ${tokenRequest.code}`);
      throw new InvalidAuthorizationCodeError(tokenRequest.code);
    }

    // Validate client_id matches
    if (mcpAuthFlow.client.clientId !== tokenRequest.client_id) {
      this.logger.warn(`Client ID mismatch for authorization code`);
      throw new ClientIdMismatchError();
    }

    // Validate authorization code hasn't been used (single-use protection)
    if (mcpAuthFlow.authorizationCodeUsed) {
      this.logger.warn(`Authorization code already used: ${tokenRequest.code}`);
      throw new AuthorizationCodeUsedError();
    }

    // Validate authorization code hasn't expired
    if (
      !mcpAuthFlow.authorizationCodeExpiresAt ||
      new Date() > mcpAuthFlow.authorizationCodeExpiresAt
    ) {
      this.logger.warn(`Authorization code expired`);
      throw new AuthorizationCodeExpiredError();
    }

    // Validate redirect_uri matches
    if (mcpAuthFlow.redirectUri !== tokenRequest.redirect_uri) {
      this.logger.warn(`Redirect URI mismatch`);
      throw new RedirectUriMismatchError();
    }

    // Validate PKCE code_verifier
    if (!mcpAuthFlow.codeChallenge || !mcpAuthFlow.codeChallengeMethod) {
      this.logger.warn(`Missing PKCE parameters in authorization flow`);
      throw new MissingPkceParametersError();
    }

    const isValidVerifier = this.validatePkceVerifier(
      tokenRequest.code_verifier,
      mcpAuthFlow.codeChallenge,
      mcpAuthFlow.codeChallengeMethod,
    );

    if (!isValidVerifier) {
      this.logger.warn(`Invalid PKCE code_verifier`);
      throw new InvalidCodeVerifierError();
    }

    const refreshToken = await this.consumeMcpAuthorizationCodeUseCase.execute(
      mcpAuthFlow,
      tokenRequest.client_id,
    );
    const config = getConfig();
    const accessToken = await this.generateAccessToken(mcpAuthFlow);

    // Build token response
    const tokenResponse: TokenResponseDto = {
      access_token: accessToken,
      token_type: TokenType.BEARER,
      expires_in: config.mcpAccessTokenDurationSeconds,
      refresh_token: refreshToken,
      scope: mcpAuthFlow.client.scopes
        ? mcpAuthFlow.client.scopes.join(' ')
        : undefined,
    };

    this.logger.log(
      `Issued access token for client: ${tokenRequest.client_id}`,
    );

    return tokenResponse;
  }

  /**
   * Handle refresh_token grant type
   * Implements OAuth 2.0 refresh token grant with token rotation
   */
  private async handleRefreshTokenGrant(
    tokenRequest: TokenRequestDto,
  ): Promise<TokenResponseDto> {
    this.logger.debug('refresh token request');
    // Validate required parameters
    if (!tokenRequest.refresh_token) {
      throw new MissingRequiredParametersError(tokenRequest.grant_type);
    }

    const { mcpAuthFlow, refreshToken } =
      await this.rotateMcpRefreshTokenUseCase.execute(
        tokenRequest.refresh_token,
        tokenRequest.client_id,
      );
    const config = getConfig();
    const accessToken = await this.generateAccessToken(mcpAuthFlow);

    // Build token response
    const tokenResponse: TokenResponseDto = {
      access_token: accessToken,
      token_type: TokenType.BEARER,
      expires_in: config.mcpAccessTokenDurationSeconds,
      refresh_token: refreshToken,
      scope: mcpAuthFlow.client.scopes
        ? mcpAuthFlow.client.scopes.join(' ')
        : undefined,
    };

    this.logger.log(
      `Refreshed access token for client: ${tokenRequest.client_id}`,
    );

    return tokenResponse;
  }

  /**
   * Validate PKCE code_verifier against code_challenge
   * Supports S256 (SHA-256) method
   */
  private validatePkceVerifier(
    codeVerifier: string,
    codeChallenge: string,
    codeChallengeMethod: string,
  ): boolean {
    if (codeChallengeMethod === 'S256') {
      // Hash the verifier and compare with challenge
      const hash = createHash('sha256').update(codeVerifier).digest();
      const computedChallenge = hash.toString('base64url');
      return computedChallenge === codeChallenge;
    } else if (codeChallengeMethod === 'plain') {
      // Direct comparison (not recommended but supported by spec)
      return codeVerifier === codeChallenge;
    }

    return false;
  }

  /**
   * Generate a signed JWT access token
   */
  private async generateAccessToken(
    mcpAuthFlow: McpAuthorizationFlowEntity,
  ): Promise<string> {
    if (
      !mcpAuthFlow.authJourney.actorId ||
      !mcpAuthFlow.authJourney.actor ||
      !mcpAuthFlow.authJourney.actor.user
    ) {
      // Cannot generate an access token for a flow without a user
      throw new Error('Cannot generate access token. Actor or user not found.');
    }

    // Build JWT payload
    const now = Math.floor(Date.now() / 1000);
    const config = getConfig();
    const payload: AccessTokenClaims = {
      iss: config.issuerUrl, // Issuer URL
      sub: mcpAuthFlow.authJourney.actorId,
      actor_id: mcpAuthFlow.authJourney.actor.id,
      actor_slug: mcpAuthFlow.authJourney.actor.slug,
      actor_type: mcpAuthFlow.authJourney.actor.type,
      email: mcpAuthFlow.authJourney.actor.user.email,
      displayName: mcpAuthFlow.authJourney.actor.displayName,
      aud: mcpAuthFlow.server.providedId, // MCP server identifier
      exp: now + config.mcpAccessTokenDurationSeconds,
      iat: now,
      jti: randomBytes(16).toString('hex'), // Unique token ID
      client_id: mcpAuthFlow.client.clientId,
      scope: mcpAuthFlow.scopes || [], // Handle null scopes
      mcp_server_identifier: mcpAuthFlow.server.providedId,
      resource: mcpAuthFlow.resource || '',
      version: '1.0.0', // Hardcoded version as requested in task description
    };

    // Sign the JWT
    const jwt = await this.tokenSignerService.signToken(payload);

    return jwt;
  }

  /**
   * Introspect a token to validate and return its metadata
   * Implements OAuth 2.0 Token Introspection (RFC 7662)
   */
  async introspectToken(
    input: IntrospectTokenInput,
  ): Promise<IntrospectTokenResult> {
    this.logger.debug(
      `Introspecting token${input.client_id ? ` for client: ${input.client_id}` : ''}`,
    );

    let claims: AccessTokenClaims;
    try {
      claims = await this.tokenVerifierService.verifyAndDecode(input.token);
    } catch (error) {
      this.logger.warn(
        `Token introspection failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      return { active: false };
    }

    // If client_id was provided in the input, validate it matches the token (optional additional security)
    // Per RFC 7662, client_id is not required in the request - it's extracted from the token
    if (input.client_id && claims.client_id !== input.client_id) {
      this.logger.warn('Client ID mismatch during introspection');
      return { active: false };
    }

    // Token is valid - build the introspection result
    const result: IntrospectTokenResult = {
      active: true,
      token_type: TokenType.BEARER,
      client_id: claims.client_id,
      sub: claims.sub,
      aud: claims.aud,
      iss: claims.iss,
      jti: claims.jti,
      exp: claims.exp,
      iat: claims.iat,
      scope: claims.scope?.join(' '),
      mcp_server_identifier: claims.mcp_server_identifier,
      resource: claims.resource,
      version: claims.version,
    };

    this.logger.log(
      `Token introspection successful for client: ${claims.client_id}`,
    );
    return result;
  }
}
