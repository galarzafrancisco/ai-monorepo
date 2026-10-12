import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { createHash, randomBytes } from 'crypto';
import { formatScope, parseScope } from '@taico/auth';
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
import { TokenEndpointAuthMethod } from './enums/token-endpoint-auth-method.enum';
import { ClientAssertionService } from './client-assertion.service';
import { McpAuthorizationFlowStatus } from '../auth-journeys/enums/mcp-authorization-flow-status.enum';
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
  InvalidRefreshTokenError,
  RefreshTokenExpiredError,
  RefreshTokenRevokedError,
  TokenServerMismatchError,
  TokenResourceMismatchError,
} from './errors/token.errors';
import { TokenVerifierService } from '../auth/crypto/token-verifier.service';
import { AccessTokenClaims } from '../auth/core/types/access-token-claims.type';
import { TokenSignerService } from '../auth/crypto/token-signer.service';
import { AuthJourneyStatus } from 'src/auth-journeys/enums/auth-journey-status.enum';
import { McpRefreshTokenEntity } from './entities/mcp-refresh-token.entity';
import {
  MCP_AUTH_SERVER_VERSION,
  getMcpServerResourceUrl,
  isSameResource,
} from '../auth/core/resource-audience';

@Injectable()
export class TokenService {
  private readonly logger = new Logger(TokenService.name);

  constructor(
    private readonly authJourneysService: AuthJourneysService,
    private readonly tokenVerifierService: TokenVerifierService,
    private readonly tokenSignerService: TokenSignerService,
    private readonly clientAssertionService: ClientAssertionService,
    @InjectRepository(McpRefreshTokenEntity)
    private readonly mcpRefreshTokenRepository: Repository<McpRefreshTokenEntity>,
  ) {}

  /**
   * Handle OAuth 2.0 token requests.
   * Routes to appropriate handler based on grant_type.
   */
  async handleTokenRequest(
    tokenRequest: TokenRequestDto,
    serverIdentifier: string,
    version: string = MCP_AUTH_SERVER_VERSION,
  ): Promise<TokenResponseDto> {
    this.logger.debug(
      `Processing token request for client: ${tokenRequest.client_id}, grant_type: ${tokenRequest.grant_type}`,
    );

    switch (tokenRequest.grant_type) {
      case GrantType.AUTHORIZATION_CODE:
        return this.handleAuthorizationCodeGrant(
          tokenRequest,
          serverIdentifier,
          version,
        );
      case GrantType.REFRESH_TOKEN:
        return this.handleRefreshTokenGrant(
          tokenRequest,
          serverIdentifier,
          version,
        );
      default:
        throw new InvalidGrantTypeError(tokenRequest.grant_type);
    }
  }

  /**
   * Handle authorization_code grant type
   */
  private async handleAuthorizationCodeGrant(
    tokenRequest: TokenRequestDto,
    serverIdentifier: string,
    version: string,
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

    this.assertGrantBoundToServer(mcpAuthFlow, tokenRequest, serverIdentifier);

    // Validate the request comes from the client the code was issued to
    const clientId = await this.authenticateClient(
      mcpAuthFlow,
      tokenRequest,
      version,
    );

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

    // Mark authorization code as used
    mcpAuthFlow.authorizationCodeUsed = true;
    mcpAuthFlow.status =
      McpAuthorizationFlowStatus.AUTHORIZATION_CODE_EXCHANGED;
    await this.authJourneysService.saveMcpAuthFlow(mcpAuthFlow);
    await this.authJourneysService.updateAuthJourneyStatus(
      mcpAuthFlow.authorizationJourneyId,
      AuthJourneyStatus.AUTHORIZATION_CODE_EXCHANGED,
    );

    // Generate tokens
    const config = getConfig();
    const accessToken = await this.generateAccessToken(mcpAuthFlow);
    const refreshToken = await this.generateAndStoreRefreshToken(
      mcpAuthFlow,
      clientId,
    );

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

    this.logger.log(`Issued access token for client: ${clientId}`);

    return tokenResponse;
  }

  /**
   * Handle refresh_token grant type
   * Implements OAuth 2.0 refresh token grant with token rotation
   */
  private async handleRefreshTokenGrant(
    tokenRequest: TokenRequestDto,
    serverIdentifier: string,
    version: string,
  ): Promise<TokenResponseDto> {
    this.logger.debug('refresh token request');
    // Validate required parameters
    if (!tokenRequest.refresh_token) {
      throw new MissingRequiredParametersError(tokenRequest.grant_type);
    }

    // Hash the provided refresh token to compare with stored hash
    const tokenHash = createHash('sha256')
      .update(tokenRequest.refresh_token)
      .digest('hex');

    // Find the refresh token in database with related authorization flow
    const storedToken = await this.mcpRefreshTokenRepository.findOne({
      where: { tokenHash },
      relations: [
        'mcpAuthorizationFlow',
        'mcpAuthorizationFlow.client',
        'mcpAuthorizationFlow.server',
        'mcpAuthorizationFlow.authJourney',
        'mcpAuthorizationFlow.authJourney.actor',
        'mcpAuthorizationFlow.authJourney.actor.user',
      ],
    });

    if (!storedToken) {
      this.logger.warn('Refresh token not found');
      throw new InvalidRefreshTokenError();
    }

    // Check if token is revoked
    if (storedToken.revokedAt) {
      this.logger.warn('Refresh token has been revoked');
      throw new RefreshTokenRevokedError();
    }

    // Check if token is expired
    if (new Date() > storedToken.expiresAt) {
      this.logger.warn('Refresh token expired');
      throw new RefreshTokenExpiredError();
    }

    const mcpAuthFlow = storedToken.mcpAuthorizationFlow;

    this.assertGrantBoundToServer(mcpAuthFlow, tokenRequest, serverIdentifier);

    // Validate the request comes from the client the refresh token was issued to
    const clientId = await this.authenticateClient(
      mcpAuthFlow,
      tokenRequest,
      version,
    );
    if (storedToken.clientId !== clientId) {
      this.logger.warn('Client ID mismatch for refresh token');
      throw new ClientIdMismatchError();
    }

    // Revoke the old refresh token (rotation)
    storedToken.revokedAt = new Date();
    await this.mcpRefreshTokenRepository.save(storedToken);

    // Generate new tokens
    const config = getConfig();
    const accessToken = await this.generateAccessToken(mcpAuthFlow);
    const newRefreshToken = await this.generateAndStoreRefreshToken(
      mcpAuthFlow,
      clientId,
    );

    // Build token response
    const tokenResponse: TokenResponseDto = {
      access_token: accessToken,
      token_type: TokenType.BEARER,
      expires_in: config.mcpAccessTokenDurationSeconds,
      refresh_token: newRefreshToken,
      scope: mcpAuthFlow.client.scopes
        ? mcpAuthFlow.client.scopes.join(' ')
        : undefined,
    };

    this.logger.log(`Refreshed access token for client: ${clientId}`);

    return tokenResponse;
  }

  /**
   * Checks that a token request comes from the client its grant belongs to,
   * and returns that client's client_id.
   *
   * A public client only names itself; PKCE is what ties the request to the
   * authorization. A client registered with private_key_jwt must also prove
   * it holds its private key, on every request.
   */
  private async authenticateClient(
    mcpAuthFlow: McpAuthorizationFlowEntity,
    tokenRequest: TokenRequestDto,
    version: string,
  ): Promise<string> {
    const { client, server } = mcpAuthFlow;

    if (
      tokenRequest.client_id !== undefined &&
      tokenRequest.client_id !== client.clientId
    ) {
      this.logger.warn('Client ID mismatch for token request');
      throw new ClientIdMismatchError();
    }

    if (
      client.tokenEndpointAuthMethod === TokenEndpointAuthMethod.PRIVATE_KEY_JWT
    ) {
      const { issuerUrl } = getConfig();
      // The audience of an assertion is the authorization server: its issuer
      // identifier, or the token endpoint as older clients send it. Each can
      // be spelled with either identifier of the MCP server.
      const audiences = [server.providedId, server.id].flatMap((identifier) => [
        `${issuerUrl}/mcp/${identifier}/${version}`,
        `${issuerUrl}/api/v1/auth/token/mcp/${identifier}/${version}`,
      ]);
      await this.clientAssertionService.authenticate(
        client,
        tokenRequest,
        audiences,
      );
    } else if (tokenRequest.client_id === undefined) {
      // Without an assertion there is nothing else that identifies the client
      throw new MissingRequiredParametersError(tokenRequest.grant_type);
    }

    return client.clientId;
  }

  /**
   * A code or refresh token is bound to the MCP server it was authorized for.
   * It can only be redeemed at that server's token endpoint, and an RFC 8707
   * `resource` in the request must name that same server.
   */
  private assertGrantBoundToServer(
    mcpAuthFlow: McpAuthorizationFlowEntity,
    tokenRequest: TokenRequestDto,
    serverIdentifier: string,
  ): void {
    const server = mcpAuthFlow.server;
    if (
      server.providedId !== serverIdentifier &&
      server.id !== serverIdentifier
    ) {
      this.logger.warn('Grant presented at another MCP server token endpoint');
      throw new TokenServerMismatchError(serverIdentifier, server.providedId);
    }

    const serverResource = getMcpServerResourceUrl(server);
    if (
      tokenRequest.resource &&
      !isSameResource(tokenRequest.resource, serverResource)
    ) {
      this.logger.warn('Token request resource does not match the grant');
      throw new TokenResourceMismatchError(
        serverResource,
        tokenRequest.resource,
      );
    }
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
    // The audience is the server's canonical resource URI (RFC 8707), derived
    // from the server the grant is bound to, never from client input.
    const serverResource = getMcpServerResourceUrl(mcpAuthFlow.server);
    const payload: AccessTokenClaims = {
      iss: config.issuerUrl, // Issuer URL
      sub: mcpAuthFlow.authJourney.actorId,
      actor_id: mcpAuthFlow.authJourney.actor.id,
      actor_slug: mcpAuthFlow.authJourney.actor.slug,
      actor_type: mcpAuthFlow.authJourney.actor.type,
      email: mcpAuthFlow.authJourney.actor.user.email,
      displayName: mcpAuthFlow.authJourney.actor.displayName,
      aud: serverResource,
      exp: now + config.mcpAccessTokenDurationSeconds,
      iat: now,
      jti: randomBytes(16).toString('hex'), // Unique token ID
      client_id: mcpAuthFlow.client.clientId,
      scope: formatScope(mcpAuthFlow.scopes ?? []),
      mcp_server_identifier: mcpAuthFlow.server.providedId,
      resource: serverResource,
      version: MCP_AUTH_SERVER_VERSION,
    };

    // Sign the JWT
    const jwt = await this.tokenSignerService.signToken(payload);

    return jwt;
  }

  /**
   * Generate and store a refresh token in the database
   * Returns the unhashed token (to be sent to client)
   */
  private async generateAndStoreRefreshToken(
    mcpAuthFlow: McpAuthorizationFlowEntity,
    clientId: string,
  ): Promise<string> {
    // Generate a cryptographically secure random token
    const token = randomBytes(32).toString('base64url');

    // Hash the token before storing
    const tokenHash = createHash('sha256').update(token).digest('hex');

    // Calculate expiration based on config
    const config = getConfig();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + config.mcpRefreshTokenDurationDays);

    // Store in database
    const refreshToken = this.mcpRefreshTokenRepository.create({
      mcpAuthorizationFlowId: mcpAuthFlow.id,
      clientId,
      tokenHash,
      expiresAt,
      revokedAt: null,
    });

    await this.mcpRefreshTokenRepository.save(refreshToken);

    this.logger.debug(
      `Stored refresh token for flow: ${mcpAuthFlow.id}, expires: ${expiresAt.toISOString()}`,
    );

    // Return the unhashed token
    return token;
  }

  /**
   * Introspect a token to validate and return its metadata
   * Implements OAuth 2.0 Token Introspection (RFC 7662)
   */
  async introspectToken(
    input: IntrospectTokenInput,
    serverIdentifier?: string,
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

    // Only a token minted for this MCP server is active here, which excludes
    // other servers' tokens and first-party tokens. This is how MCP servers
    // that validate through introspection enforce their audience.
    if (serverIdentifier && claims.mcp_server_identifier !== serverIdentifier) {
      this.logger.warn('Token introspected at another MCP server endpoint');
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
      scope: formatScope(parseScope(claims.scope)),
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
