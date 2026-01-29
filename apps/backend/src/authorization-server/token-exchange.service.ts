import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
  UnauthorizedException,
  InternalServerErrorException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { McpConnectionEntity } from '../mcp-registry/entities/mcp-connection.entity';
import { McpScopeMappingEntity } from '../mcp-registry/entities/mcp-scope-mapping.entity';
import { ConnectionAuthorizationFlowEntity } from '../auth-journeys/entities/connection-authorization-flow.entity';
import { McpRegistryService } from '../mcp-registry/mcp-registry.service';
import { JwksService } from '../auth/crypto/jwks.service';
import { TokenExchangeRequestDto } from './dto/token-exchange-request.dto';
import { TokenExchangeResponseDto } from './dto/token-exchange-response.dto';
import { AccessTokenClaims } from 'src/auth/core/types/access-token-claims.type';
import { TokenVerifierService } from 'src/auth/crypto/token-verifier.service';
import { AuthJourneyStatus } from 'src/auth-journeys/enums/auth-journey-status.enum';
import { ConnectionAuthorizationFlowStatus } from 'src/auth-journeys/enums/connection-authorization-flow-status.enum';

interface DownstreamTokenInfo {
  accessToken: string;
  expiresAt?: Date;
}

@Injectable()
export class TokenExchangeService {
  private readonly logger = new Logger(TokenExchangeService.name);

  constructor(
    @InjectRepository(McpConnectionEntity)
    private readonly mcpConnectionRepository: Repository<McpConnectionEntity>,
    @InjectRepository(McpScopeMappingEntity)
    private readonly mcpScopeMappingRepository: Repository<McpScopeMappingEntity>,
    @InjectRepository(ConnectionAuthorizationFlowEntity)
    private readonly connectionAuthorizationFlowRepository: Repository<ConnectionAuthorizationFlowEntity>,
    private readonly mcpRegistryService: McpRegistryService,
    private readonly tokenVerifierService: TokenVerifierService,
  ) {}

  /**
   * Exchange MCP JWT for downstream system token (RFC 8693 compliant)
   */
  async exchangeToken(
    request: TokenExchangeRequestDto,
    serverIdentifier: string,
  ): Promise<TokenExchangeResponseDto> {
    this.logger.debug(
      `Processing token exchange for resource: ${request.resource}`,
    );

    // Step 1: Resolve MCP Server UUID from providedId (with caching)
    const serverId =
      await this.mcpRegistryService.resolveServerIdFromProvidedId(
        serverIdentifier,
      );
    if (!serverId) {
      this.logger.warn(`MCP Server not found: ${serverIdentifier}`);
      throw new NotFoundException('MCP Server not found');
    }

    // Step 2: Validate and decode MCP JWT
    const mcpTokenPayload = await this.validateMcpJwt(
      request.subject_token,
      serverIdentifier,
    );

    // Step 3: Extract MCP scopes from JWT
    const mcpScopes = mcpTokenPayload.scope;

    // Step 4: Lookup connection by resource (providedId or UUID)
    const connection = await this.findConnection(request.resource, serverId);
    if (!connection) {
      this.logger.warn(`Connection not found: ${request.resource}`);
      throw new NotFoundException('Connection not found');
    }

    // Step 5: Resolve downstream scope entitlements
    const entitledDownstreamScopes = await this.resolveDownstreamScopes(
      mcpScopes,
      connection.id,
    );

    // Step 6: Validate requested scopes (if provided)
    const requestedScopes = request.scope
      ? request.scope.split(' ')
      : entitledDownstreamScopes;
    this.validateScopeEntitlement(requestedScopes, entitledDownstreamScopes);

    // Step 7: Get or refresh downstream token
    const downstreamToken = await this.getDownstreamToken(
      connection,
      mcpTokenPayload.client_id,
      requestedScopes,
    );

    // Step 8: Return RFC 8693 response
    return new TokenExchangeResponseDto(
      downstreamToken.accessToken,
      'urn:ietf:params:oauth:token-type:access_token',
      'Bearer',
      this.calculateExpiresIn(downstreamToken.expiresAt),
      requestedScopes.join(' '),
    );
  }

  /**
   * Validate MCP JWT and extract payload
   */
  private async validateMcpJwt(
    token: string,
    expectedAudience: string,
  ): Promise<AccessTokenClaims> {
    let claims: AccessTokenClaims;
    try {
      claims = await this.tokenVerifierService.verifyAndDecode(token);
    } catch (error) {
      throw new UnauthorizedException('Token validation failed');
    }

    // Additional checks: audience
    if (claims.aud !== expectedAudience) {
      this.logger.warn(
        `MCP JWT audience mismatch: expected ${expectedAudience}, got ${claims.aud}`,
      );
      throw new UnauthorizedException('MCP JWT audience mismatch');
    }

    return claims;
  }

  /**
   * Find connection by providedId or UUID
   */
  private async findConnection(
    resource: string,
    serverId: string,
  ): Promise<McpConnectionEntity | null> {
    // Try UUID first (faster, indexed)
    if (this.isUuid(resource)) {
      const conn = await this.mcpConnectionRepository.findOne({
        where: { id: resource, serverId: serverId },
      });
      if (conn) return conn;
    }

    // Try providedId
    return await this.mcpConnectionRepository.findOne({
      where: { providedId: resource, serverId: serverId },
    });
  }

  /**
   * Check if string is a valid UUID
   */
  private isUuid(str: string): boolean {
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return uuidRegex.test(str);
  }

  /**
   * Resolve downstream scopes based on MCP scopes and connection mappings
   */
  private async resolveDownstreamScopes(
    mcpScopes: string[],
    connectionId: string,
  ): Promise<string[]> {
    // Query: Get all scope mappings for this connection
    const mappings = await this.mcpScopeMappingRepository.find({
      where: {
        connectionId: connectionId,
        scopeId: In(mcpScopes), // Only mappings for granted MCP scopes
      },
    });

    // Extract unique downstream scopes
    const downstreamScopes = [
      ...new Set(mappings.map((m) => m.downstreamScope)),
    ];

    return downstreamScopes;
  }

  /**
   * Validate that requested scopes are a subset of entitled scopes
   */
  private validateScopeEntitlement(
    requestedScopes: string[],
    entitledScopes: string[],
  ): void {
    const entitledSet = new Set(entitledScopes);

    for (const requestedScope of requestedScopes) {
      if (!entitledSet.has(requestedScope)) {
        this.logger.warn(
          `Scope escalation attempt: '${requestedScope}' not entitled`,
        );
        throw new ForbiddenException(
          `Insufficient scope: '${requestedScope}' not entitled. ` +
            `Entitled scopes: ${entitledScopes.join(', ')}`,
        );
      }
    }
  }

  /**
   * Get downstream token, refreshing if necessary
   */
  private async getDownstreamToken(
    connection: McpConnectionEntity,
    clientId: string,
    requestedScopes: string[],
  ): Promise<DownstreamTokenInfo> {
    // Find the authorization flow for this connection + client
    const authFlow = await this.connectionAuthorizationFlowRepository.findOne({
      where: {
        mcpConnectionId: connection.id,
        status: ConnectionAuthorizationFlowStatus.AUTHORIZED,
      },
      relations: ['authJourney', 'authJourney.mcpAuthorizationFlow'],
    });

    if (!authFlow || !authFlow.accessToken) {
      this.logger.warn(
        `No authorized connection found for connection: ${connection.id}`,
      );
      throw new UnauthorizedException(
        'No authorized connection found for this client',
      );
    }

    // Check if token is valid (not expired, has required scopes)
    const now = new Date();
    const expiresAt = authFlow.tokenExpiresAt;
    const bufferMinutes = 5;

    if (
      expiresAt &&
      now >= new Date(expiresAt.getTime() - bufferMinutes * 60 * 1000)
    ) {
      // Token expired or expiring soon - refresh it
      this.logger.debug(`Token expired or expiring soon, refreshing...`);
      return await this.refreshDownstreamToken(authFlow, connection);
    }

    // Token is valid
    return {
      accessToken: authFlow.accessToken,
      expiresAt: authFlow.tokenExpiresAt,
    };
  }

  /**
   * Refresh downstream token using refresh token
   */
  private async refreshDownstreamToken(
    authFlow: ConnectionAuthorizationFlowEntity,
    connection: McpConnectionEntity,
  ): Promise<DownstreamTokenInfo> {
    if (!authFlow.refreshToken) {
      this.logger.warn(
        'No refresh token available for downstream token refresh',
      );
      throw new UnauthorizedException('No refresh token available');
    }

    try {
      // Build form-encoded request body
      const body = new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: authFlow.refreshToken,
        client_id: connection.clientId,
        client_secret: connection.clientSecret,
      });

      // Exchange refresh token with downstream provider
      const response = await fetch(connection.tokenUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: body.toString(),
      });

      if (!response.ok) {
        const errorText = await response.text();
        this.logger.error(
          `Token refresh failed: ${response.status} - ${errorText}`,
        );
        throw new Error(`Token refresh failed with status ${response.status}`);
      }

      const data = await response.json();
      const { access_token, expires_in, refresh_token } = data;

      // Update stored tokens
      authFlow.accessToken = access_token;
      authFlow.tokenExpiresAt = new Date(Date.now() + expires_in * 1000);
      if (refresh_token) {
        authFlow.refreshToken = refresh_token; // Some providers rotate refresh tokens
      }
      await this.connectionAuthorizationFlowRepository.save(authFlow);

      this.logger.log(`Successfully refreshed downstream token`);

      return {
        accessToken: access_token,
        expiresAt: authFlow.tokenExpiresAt,
      };
    } catch (error) {
      this.logger.error(
        `Failed to refresh downstream token: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      throw new InternalServerErrorException(
        'Failed to refresh downstream token',
      );
    }
  }

  /**
   * Calculate expires_in from expiration date
   */
  private calculateExpiresIn(expiresAt?: Date): number {
    if (!expiresAt) {
      return 3600; // Default 1 hour
    }

    const now = new Date();
    const expiresInMs = expiresAt.getTime() - now.getTime();
    return Math.max(0, Math.floor(expiresInMs / 1000)); // Convert to seconds
  }
}
