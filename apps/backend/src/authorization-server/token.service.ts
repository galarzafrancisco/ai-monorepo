import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SignJWT, importPKCS8, jwtVerify, createRemoteJWKSet, errors } from 'jose';
import { createHash, randomBytes } from 'crypto';
import { McpAuthorizationFlowEntity } from 'src/auth-journeys/entities';
import { AuthJourneysService } from 'src/auth-journeys/auth-journeys.service';
import { IdentityProviderService } from 'src/identity-provider/identity-provider.service';
import { JwksService } from './jwks.service';
import { RefreshTokenEntity } from './refresh-token.entity';
import { TokenRequestDto } from './dto/token-request.dto';
import { TokenResponseDto } from './dto/token-response.dto';
import { IntrospectTokenRequestDto } from './dto/introspect-token-request.dto';
import { IntrospectTokenResponseDto } from './dto/introspect-token-response.dto';
import { GrantType } from './enums/grant-type.enum';
import { TokenType } from './enums/token-type.enum';
import { McpJwtPayload } from './types/mcp-jwt-payload.type';
import { McpAuthorizationFlowStatus } from 'src/auth-journeys/enums/mcp-authorization-flow-status.enum';
import { getConfig } from 'src/config/env.config';
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

@Injectable()
export class TokenService {
  private readonly logger = new Logger(TokenService.name);

  constructor(
    private readonly authJourneysService: AuthJourneysService,
    private readonly jwksService: JwksService,
    private readonly identityProviderService: IdentityProviderService,
    @InjectRepository(RefreshTokenEntity)
    private readonly refreshTokenRepository: Repository<RefreshTokenEntity>,
  ) {}

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
      ['client', 'server']
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
    const config = getConfig();
    const payload: McpJwtPayload = {
      iss: config.issuerUrl, // Issuer URL
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
    this.logger.debug(`Introspecting token${request.client_id ? ` for client: ${request.client_id}` : ''}`);

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
      const config = getConfig();
      const { payload } = await jwtVerify(request.token, getKey as any, {
        issuer: config.issuerUrl,
        algorithms: ['RS256'],
      });

      // Cast payload to our expected type
      const mcpPayload = payload as unknown as McpJwtPayload;

      // If client_id was provided in the request, validate it matches the token (optional additional security)
      // Per RFC 7662, client_id is not required in the request - it's extracted from the token
      if (request.client_id && mcpPayload.client_id !== request.client_id) {
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

      this.logger.log(`Token introspection successful for client: ${mcpPayload.client_id}`);
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

  /**
   * Web Authentication: Login with email and password
   * Returns access and refresh tokens
   */
  async login(email: string, password: string): Promise<{ accessToken: string; refreshToken: string; expiresIn: number }> {
    this.logger.debug(`Login attempt for email: ${email}`);

    // Validate user credentials
    const user = await this.identityProviderService.validateUser(email, password);

    // Generate access token (10 min expiration)
    const accessToken = await this.generateWebAccessToken(user.id, user.email, user.displayName, user.role);

    // Generate refresh token (1 day expiration)
    const refreshToken = await this.generateAndStoreRefreshToken(user.id);

    this.logger.log(`User logged in successfully: ${email}`);

    return {
      accessToken,
      refreshToken,
      expiresIn: 600, // 10 minutes
    };
  }

  /**
   * Web Authentication: Refresh access token using refresh token
   * Returns new access and refresh tokens
   */
  async refreshWebToken(refreshToken: string): Promise<{ accessToken: string; refreshToken: string; expiresIn: number }> {
    this.logger.debug('Refresh token request');

    // Hash the provided refresh token to compare with stored hash
    const tokenHash = createHash('sha256').update(refreshToken).digest('hex');

    // Find the refresh token in database
    const storedToken = await this.refreshTokenRepository.findOne({
      where: { tokenHash },
      relations: ['user'],
    });

    if (!storedToken) {
      this.logger.warn('Refresh token not found');
      throw new UnauthorizedException('Invalid refresh token');
    }

    // Check if token is revoked
    if (storedToken.revokedAt) {
      this.logger.warn('Refresh token has been revoked');
      throw new UnauthorizedException('Refresh token revoked');
    }

    // Check if token is expired
    if (new Date() > storedToken.expiresAt) {
      this.logger.warn('Refresh token expired');
      throw new UnauthorizedException('Refresh token expired');
    }

    // Revoke the old refresh token
    storedToken.revokedAt = new Date();
    await this.refreshTokenRepository.save(storedToken);

    // Generate new tokens
    const user = storedToken.user;
    const newAccessToken = await this.generateWebAccessToken(user.id, user.email, user.displayName, user.role);
    const newRefreshToken = await this.generateAndStoreRefreshToken(user.id);

    this.logger.log(`Refresh token exchanged successfully for user: ${user.email}`);

    return {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
      expiresIn: 600, // 10 minutes
    };
  }

  /**
   * Web Authentication: Validate access token
   * Returns decoded JWT payload
   */
  async validateWebToken(accessToken: string): Promise<any> {
    this.logger.debug('Validating web access token');

    try {
      // Get all valid public keys for verification
      const publicKeys = await this.jwksService.getPublicKeys();

      if (publicKeys.length === 0) {
        this.logger.error('No valid public keys available for token verification');
        throw new UnauthorizedException('Token validation failed');
      }

      // Create a local JWKS resolver
      const getKey = async (header: any) => {
        const key = publicKeys.find((k) => k.kid === header.kid);
        if (!key) {
          throw new Error('Key not found');
        }
        return key as any;
      };

      // Verify JWT with our JWKS
      const config = getConfig();
      const { payload } = await jwtVerify(accessToken, getKey as any, {
        issuer: config.issuerUrl,
        algorithms: ['RS256'],
      });

      // Verify token type is 'access'
      if ((payload as any).type !== 'access') {
        this.logger.warn('Token type mismatch');
        throw new UnauthorizedException('Invalid token type');
      }

      this.logger.debug('Web access token validated successfully');
      return payload;
    } catch (error) {
      if (error instanceof errors.JWTExpired) {
        this.logger.debug('Access token expired');
        throw new UnauthorizedException('Token expired');
      } else if (error instanceof errors.JWSSignatureVerificationFailed) {
        this.logger.warn('Token signature verification failed');
        throw new UnauthorizedException('Invalid token signature');
      } else {
        this.logger.warn(`Token validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        throw new UnauthorizedException('Token validation failed');
      }
    }
  }

  /**
   * Generate a signed JWT access token for web authentication
   */
  private async generateWebAccessToken(
    userId: string,
    email: string,
    displayName: string,
    role: 'admin' | 'standard',
  ): Promise<string> {
    // Get active signing key
    const signingKey = await this.jwksService.getActiveSigningKey();

    // Import private key from PEM
    const privateKey = await importPKCS8(signingKey.privateKeyPem, signingKey.algorithm);

    // Build JWT payload
    const now = Math.floor(Date.now() / 1000);
    const config = getConfig();

    // Determine scopes based on role
    const scope = role === 'admin' ? ['monolith:user', 'monolith:admin'] : ['monolith:user'];

    const payload = {
      iss: config.issuerUrl,
      sub: userId,
      email,
      displayName,
      scope,
      iat: now,
      exp: now + 600, // 10 minutes
      jti: randomBytes(16).toString('hex'),
      type: 'access',
    };

    // Sign and return JWT
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
   * Generate and store a refresh token in the database
   * Returns the unhashed token (to be sent to client)
   */
  private async generateAndStoreRefreshToken(userId: string): Promise<string> {
    // Generate a cryptographically secure random token
    const token = randomBytes(32).toString('base64url');

    // Hash the token before storing
    const tokenHash = createHash('sha256').update(token).digest('hex');

    // Calculate expiration (1 day)
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 1);

    // Store in database
    const refreshToken = this.refreshTokenRepository.create({
      userId,
      tokenHash,
      expiresAt,
      revokedAt: null,
    });

    await this.refreshTokenRepository.save(refreshToken);

    // Return the unhashed token
    return token;
  }
}
