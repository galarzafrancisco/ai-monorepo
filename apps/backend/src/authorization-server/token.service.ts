import { Injectable, Logger } from '@nestjs/common';
import { createHash, randomBytes } from 'crypto';
import { McpAuthorizationFlowEntity } from '../auth-journeys/entities';
import { AuthJourneysService } from '../auth-journeys/auth-journeys.service';
import { TokenRequestDto } from './dto/token-request.dto';
import { TokenResponseDto } from './dto/token-response.dto';
import { IntrospectTokenRequestDto } from './dto/introspect-token-request.dto';
import { IntrospectTokenResponseDto } from './dto/introspect-token-response.dto';
import { GrantType } from './enums/grant-type.enum';
import { TokenType } from './enums/token-type.enum';
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
} from './errors/token.errors';
import { TokenVerifierService } from '../auth/crypto/token-verifier.service';
import { AccessTokenClaims } from '../auth/core/types/access-token-claims.type';
import { TokenSignerService } from '../auth/crypto/token-signer.service';
import { AuthJourneyStatus } from 'src/auth-journeys/enums/auth-journey-status.enum';

@Injectable()
export class TokenService {
  private readonly logger = new Logger(TokenService.name);

  constructor(
    private readonly authJourneysService: AuthJourneysService,
    private readonly tokenVerifierService: TokenVerifierService,
    private readonly tokenSignerService: TokenSignerService,
  ) { }

  /**
   * Exchange authorization code for access token
   * Implements OAuth 2.0 authorization code grant with PKCE validation
   */
  async exchangeAuthorizationCode(tokenRequest: TokenRequestDto): Promise<TokenResponseDto> {
    this.logger.debug(`Processing token request for client: ${tokenRequest.client_id}`);

    // Validate grant type
    if (tokenRequest.grant_type !== GrantType.AUTHORIZATION_CODE) {
      throw new InvalidGrantTypeError(tokenRequest.grant_type);
    }

    // Validate required parameters
    if (!tokenRequest.code || !tokenRequest.code_verifier || !tokenRequest.redirect_uri) {
      throw new MissingRequiredParametersError(tokenRequest.grant_type);
    }

    // Find the authorization flow by authorization code
    const mcpAuthFlow = await this.authJourneysService.findMcpAuthFlowByAuthorizationCode(
      tokenRequest.code,
      ['client', 'server', 'authJourney', 'authJourney.user']
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
    if (!mcpAuthFlow.authorizationCodeExpiresAt || new Date() > mcpAuthFlow.authorizationCodeExpiresAt) {
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
    mcpAuthFlow.status = McpAuthorizationFlowStatus.AUTHORIZATION_CODE_EXCHANGED;
    await this.authJourneysService.saveMcpAuthFlow(mcpAuthFlow);
    await this.authJourneysService.updateAuthJourneyStatus(
      mcpAuthFlow.authorizationJourneyId,
      AuthJourneyStatus.AUTHORIZATION_CODE_EXCHANGED,
    );

    // Generate access token (JWT)
    const accessToken = await this.generateAccessToken(mcpAuthFlow);

    // Generate refresh token (placeholder - will implement later)
    const refreshToken = this.generateRefreshToken();

    // Build token response
    const tokenResponse: TokenResponseDto = {
      access_token: accessToken,
      token_type: TokenType.BEARER,
      expires_in: 3600, // 1 hour
      refresh_token: refreshToken,
      scope: mcpAuthFlow.client.scopes ? mcpAuthFlow.client.scopes.join(' ') : undefined,
    };

    this.logger.log(`Issued access token for client: ${tokenRequest.client_id}`);

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
  private async generateAccessToken(mcpAuthFlow: McpAuthorizationFlowEntity): Promise<string> {

    // Build JWT payload
    const now = Math.floor(Date.now() / 1000);
    const config = getConfig();
    const payload: AccessTokenClaims = {
      iss: config.issuerUrl, // Issuer URL
      sub: mcpAuthFlow.authJourney.userId || 'user-not-found???', // TODO: Replace with actual user ID when user auth is implemented
      email: mcpAuthFlow.authJourney.user?.email,
      displayName: mcpAuthFlow.authJourney.user?.displayName,
      aud: mcpAuthFlow.server.providedId, // MCP server identifier
      exp: now + 3600, // 1 hour expiration
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
   * Generate a cryptographically secure refresh token
   * TODO: Store in database and implement refresh token grant
   */
  private generateRefreshToken(): string {
    return randomBytes(32).toString('base64url');
  }


  /**
   * Introspect a token to validate and return its metadata
   * Implements OAuth 2.0 Token Introspection (RFC 7662)
   */
  // TODO: this is a service. Should not have DTOs with HTTP concerns as interfaces. Fix!
  async introspectToken(request: IntrospectTokenRequestDto): Promise<IntrospectTokenResponseDto> {
    this.logger.debug(`Introspecting token${request.client_id ? ` for client: ${request.client_id}` : ''}`);

    let claims: AccessTokenClaims;
    try {
      claims = await this.tokenVerifierService.verifyAndDecode(request.token);
    } catch (error) {
      this.logger.warn(`Token introspection failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return { active: false } as IntrospectTokenResponseDto;
    }

    // If client_id was provided in the request, validate it matches the token (optional additional security)
    // Per RFC 7662, client_id is not required in the request - it's extracted from the token
    if (request.client_id && claims.client_id !== request.client_id) {
      this.logger.warn('Client ID mismatch during introspection');
      return { active: false } as IntrospectTokenResponseDto;
    }

    // Token is valid - build the introspection response
    const response: IntrospectTokenResponseDto = {
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

    this.logger.log(`Token introspection successful for client: ${claims.client_id}`);
    return response;
  }
}
