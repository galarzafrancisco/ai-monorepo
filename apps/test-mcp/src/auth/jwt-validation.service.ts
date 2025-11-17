import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import * as jwt from 'jsonwebtoken';
import { JwksClient } from 'jwks-rsa';
import { McpJwtPayload } from './mcp-jwt-payload.type';
import { AUTHORIZATION_SERVER_URL } from '../config/as.config';

@Injectable()
export class JwtValidationService {
  private readonly logger = new Logger(JwtValidationService.name);
  private readonly jwksClient: JwksClient;

  constructor() {
    const authorizationServerBaseUrl = new URL(AUTHORIZATION_SERVER_URL).origin;
    const jwksUri = `${authorizationServerBaseUrl}/.well-known/jwks.json`;
    this.logger.log(`Initializing JWKS client with URI: ${jwksUri}`);

    this.jwksClient = new JwksClient({
      jwksUri,
      cache: true,
      cacheMaxAge: 600000, // 10 minutes
      rateLimit: true,
      jwksRequestsPerMinute: 10,
    });
  }

  /**
   * Validates a JWT token using the JWKS from the authorization server.
   * Validates signature, expiration, and other standard claims.
   *
   * @param token - The JWT token to validate
   * @returns The decoded and validated JWT payload
   * @throws UnauthorizedException if the token is invalid
   */
  async validateToken(token: string): Promise<McpJwtPayload> {
    try {
      // Decode the token header to get the key ID (kid)
      const decodedToken = jwt.decode(token, { complete: true });

      if (!decodedToken || typeof decodedToken === 'string') {
        this.logger.error('Failed to decode JWT token');
        throw new UnauthorizedException('Invalid token format');
      }

      const { kid } = decodedToken.header;

      if (!kid) {
        this.logger.error('Token missing kid in header');
        throw new UnauthorizedException('Token missing key identifier');
      }

      // Get the signing key from JWKS
      const key = await this.jwksClient.getSigningKey(kid);
      const publicKey = key.getPublicKey();

      // Verify the token signature and decode payload
      const payload = jwt.verify(token, publicKey, {
        algorithms: ['RS256', 'RS384', 'RS512', 'ES256', 'ES384', 'ES512'],
        complete: false,
      }) as McpJwtPayload;

      // Validate expiration (jwt.verify already checks exp, but let's be explicit)
      const now = Math.floor(Date.now() / 1000);
      if (payload.exp && payload.exp < now) {
        this.logger.error(`Token expired at ${new Date(payload.exp * 1000).toISOString()}`);
        throw new UnauthorizedException('Token has expired');
      }

      this.logger.debug(`Successfully validated token for subject: ${payload.sub}`);
      return payload;

    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }

      if (error instanceof jwt.JsonWebTokenError) {
        this.logger.error(`JWT validation error: ${error.message}`);
        throw new UnauthorizedException('Invalid token signature or format');
      }

      if (error instanceof jwt.TokenExpiredError) {
        this.logger.error(`Token expired: ${error.message}`);
        throw new UnauthorizedException('Token has expired');
      }

      this.logger.error(`Unexpected error validating token: ${error}`);
      throw new UnauthorizedException('Token validation failed');
    }
  }
}
