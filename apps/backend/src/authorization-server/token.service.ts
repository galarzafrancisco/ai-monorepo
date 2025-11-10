import { Injectable, BadRequestException, UnauthorizedException, Logger } from '@nestjs/common';
import { SignJWT, importPKCS8, jwtVerify, createRemoteJWKSet, errors } from 'jose';
import { createHash, randomBytes } from 'crypto';
import { McpAuthorizationFlowEntity } from 'src/auth-journeys/entities';
import { AuthJourneysService } from 'src/auth-journeys/auth-journeys.service';
import { JwksService } from './jwks.service';
import { TokenRequestDto } from './dto/token-request.dto';
import { TokenResponseDto } from './dto/token-response.dto';
import { IntrospectTokenRequestDto } from './dto/introspect-token-request.dto';
import { IntrospectTokenResponseDto } from './dto/introspect-token-response.dto';
import { GrantType } from './enums/grant-type.enum';
import { TokenType } from './enums/token-type.enum';
import { McpJwtPayload } from './types/mcp-jwt-payload.type';
import { McpAuthorizationFlowStatus } from 'src/auth-journeys/enums/mcp-authorization-flow-status.enum';

@Injectable()
export class TokenService {
  private readonly logger = new Logger(TokenService.name);

  constructor(
    private readonly authJourneysService: AuthJourneysService,
    private readonly jwksService: JwksService,
  ) {}

  /**
   * Exchange authorization code for access token
   * Implements OAuth 2.0 authorization code grant with PKCE validation
   */
  async exchangeAuthorizationCode(tokenRequest: TokenRequestDto): Promise<TokenResponseDto> {
    this.logger.debug(`Processing token request for client: ${tokenRequest.client_id}`);

    // Validate grant type
    if (tokenRequest.grant_type !== GrantType.AUTHORIZATION_CODE) {
      throw new BadRequestException('Invalid grant_type');
    }

    // Validate required parameters
    if (!tokenRequest.code || !tokenRequest.code_verifier || !tokenRequest.redirect_uri) {
      throw new BadRequestException('Missing required parameters for authorization_code grant');
    }

    // Find the authorization flow by authorization code
    const mcpAuthFlow = await this.authJourneysService.findMcpAuthFlowByAuthorizationCode(
      tokenRequest.code,
      ['client', 'server']
    );

    if (!mcpAuthFlow) {
      this.logger.warn(`Authorization code not found: ${tokenRequest.code}`);
      throw new UnauthorizedException('Invalid authorization code');
    }

    // Validate client_id matches
    if (mcpAuthFlow.client.clientId !== tokenRequest.client_id) {
      this.logger.warn(`Client ID mismatch for authorization code`);
      throw new UnauthorizedException('Client ID mismatch');
    }

    // Validate authorization code hasn't been used (single-use protection)
    if (mcpAuthFlow.authorizationCodeUsed) {
      this.logger.warn(`Authorization code already used: ${tokenRequest.code}`);
      throw new UnauthorizedException('Authorization code has already been used');
    }

    // Validate authorization code hasn't expired
    if (!mcpAuthFlow.authorizationCodeExpiresAt || new Date() > mcpAuthFlow.authorizationCodeExpiresAt) {
      this.logger.warn(`Authorization code expired`);
      throw new UnauthorizedException('Authorization code has expired');
    }

    // Validate redirect_uri matches
    if (mcpAuthFlow.redirectUri !== tokenRequest.redirect_uri) {
      this.logger.warn(`Redirect URI mismatch`);
      throw new BadRequestException('Redirect URI mismatch');
    }

    // Validate PKCE code_verifier
    if (!mcpAuthFlow.codeChallenge || !mcpAuthFlow.codeChallengeMethod) {
      this.logger.warn(`Missing PKCE parameters in authorization flow`);
      throw new BadRequestException('Missing PKCE parameters');
    }

    const isValidVerifier = this.validatePkceVerifier(
      tokenRequest.code_verifier,
      mcpAuthFlow.codeChallenge,
      mcpAuthFlow.codeChallengeMethod,
    );

    if (!isValidVerifier) {
      this.logger.warn(`Invalid PKCE code_verifier`);
      throw new UnauthorizedException('Invalid code_verifier');
    }

    // Mark authorization code as used
    mcpAuthFlow.authorizationCodeUsed = true;
    mcpAuthFlow.status = McpAuthorizationFlowStatus.AUTHORIZATION_CODE_EXCHANGED;
    await this.authJourneysService.saveMcpAuthFlow(mcpAuthFlow);

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
    // Get active signing key
    const signingKey = await this.jwksService.getActiveSigningKey();

    // Import private key from PEM
    const privateKey = await importPKCS8(signingKey.privateKeyPem, signingKey.algorithm);

    // Build JWT payload
    const now = Math.floor(Date.now() / 1000);
    const payload: McpJwtPayload = {
      iss: process.env.ISSUER_URL || 'http://localhost:4000', // Issuer URL
      sub: 'user-placeholder', // TODO: Replace with actual user ID when user auth is implemented
      aud: mcpAuthFlow.server.providedId, // MCP server identifier
      exp: now + 3600, // 1 hour expiration
      iat: now,
      jti: randomBytes(16).toString('hex'), // Unique token ID
      client_id: mcpAuthFlow.client.clientId,
      scope: mcpAuthFlow.client.scopes || [], // Handle null scopes
      server_identifier: mcpAuthFlow.server.providedId,
      resource: mcpAuthFlow.resource || '',
      version: '1.0.0', // Hardcoded version as requested in task description
    };

    // Sign and return JWT - cast to any to handle index signature requirement
    const jwt = await new SignJWT(payload as any)
      .setProtectedHeader({
        alg: signingKey.algorithm,
        kid: signingKey.kid,
        typ: 'JWT',
      })
      .sign(privateKey);

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
  async introspectToken(request: IntrospectTokenRequestDto): Promise<IntrospectTokenResponseDto> {
    this.logger.debug(`Introspecting token for client: ${request.client_id}`);

    try {
      // Get all valid public keys for verification
      const publicKeys = await this.jwksService.getPublicKeys();

      if (publicKeys.length === 0) {
        this.logger.error('No valid public keys available for token verification');
        // Return inactive token response instead of throwing
        return { active: false } as IntrospectTokenResponseDto;
      }

      // Create a JWKS object from our keys
      const jwks = {
        keys: publicKeys,
      };

      // Verify the JWT signature and decode payload
      // We need to create a local JWKS resolver since we don't have a remote JWKS endpoint
      const getKey = async (header: any) => {
        const key = publicKeys.find((k) => k.kid === header.kid);
        if (!key) {
          throw new Error('Key not found');
        }
        return key as any;
      };

      // Verify JWT with our JWKS
      const { payload } = await jwtVerify(request.token, getKey as any, {
        issuer: process.env.ISSUER_URL || 'http://localhost:4000',
        algorithms: ['RS256'],
      });

      // Cast payload to our expected type
      const mcpPayload = payload as unknown as McpJwtPayload;

      // Validate client_id matches the token
      if (mcpPayload.client_id !== request.client_id) {
        this.logger.warn('Client ID mismatch during introspection');
        return { active: false } as IntrospectTokenResponseDto;
      }

      // Token is valid - build the introspection response
      const response: IntrospectTokenResponseDto = {
        active: true,
        token_type: TokenType.BEARER,
        client_id: mcpPayload.client_id,
        sub: mcpPayload.sub,
        aud: mcpPayload.aud,
        iss: mcpPayload.iss,
        jti: mcpPayload.jti,
        exp: mcpPayload.exp,
        iat: mcpPayload.iat,
        nbf: (payload as any).nbf, // nbf is optional and not in McpJwtPayload type
        scope: mcpPayload.scope?.join(' '),
        server_identifier: mcpPayload.server_identifier,
        resource: mcpPayload.resource,
        version: mcpPayload.version,
      };

      this.logger.log(`Token introspection successful for client: ${request.client_id}`);
      return response;
    } catch (error) {
      // Token is invalid (expired, bad signature, etc.)
      if (error instanceof errors.JWTExpired) {
        this.logger.debug('Token expired during introspection');
      } else if (error instanceof errors.JWSSignatureVerificationFailed) {
        this.logger.warn('Token signature verification failed');
      } else {
        this.logger.warn(`Token introspection failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }

      // Return inactive response for any validation failure
      // Per RFC 7662, we should not reveal why the token is invalid
      return { active: false } as IntrospectTokenResponseDto;
    }
  }
}
