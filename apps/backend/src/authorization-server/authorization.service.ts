import { Injectable, NotFoundException, BadRequestException, UnauthorizedException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { randomBytes } from 'crypto';
import { RegisteredClientEntity } from './registered-client.entity';
import { AuthorizationRequestDto } from './dto/authorization-request.dto';
import { ConsentDecisionDto } from './dto/consent-decision.dto';
import { McpRegistryService } from 'src/mcp-registry/mcp-registry.service';
import { AuthJourneysService } from 'src/auth-journeys/auth-journeys.service';
import { McpAuthorizationFlowEntity, ConnectionAuthorizationFlowEntity } from 'src/auth-journeys/entities';
import { McpAuthorizationFlowStatus } from 'src/auth-journeys/enums/mcp-authorization-flow-status.enum';
import { auth } from '@modelcontextprotocol/sdk/client/auth.js';
import { CallbackRequestDto } from './dto/callback-request.dto';

@Injectable()
export class AuthorizationService {
  private logger = new Logger(AuthJourneysService.name);
  constructor(
    @InjectRepository(RegisteredClientEntity)
    private readonly clientRepository: Repository<RegisteredClientEntity>,
    private readonly authJourneysService: AuthJourneysService,
    private readonly mcpRegistryService: McpRegistryService,
  ) { }

  /**
   * Process an authorization request and store PKCE parameters
   * Returns the flow ID to be used in the consent screen
   */
  async processAuthorizationRequest(
    authRequest: AuthorizationRequestDto,
    serverIdentifier: string,
    version: string,
  ): Promise<string> {
    // Validate that the MCP Server exists
    const mcpServer = await this.mcpRegistryService.getServerByProvidedId(serverIdentifier);
    if (!mcpServer) {
      throw new NotFoundException(`MCP server '${serverIdentifier}' not found`);
    }

    // Validate that the client exists
    const client = await this.clientRepository.findOne({
      where: { clientId: authRequest.client_id },
    });
    if (!client) {
      throw new NotFoundException(`Client '${authRequest.client_id}' not found`);
    }

    // Validate that the redirect_uri matches one of the registered URIs
    if (!client.redirectUris.includes(authRequest.redirect_uri)) {
      throw new BadRequestException(
        `Redirect URI '${authRequest.redirect_uri}' is not registered for this client`,
      );
    }

    // Validate the scopes requested
    let scopes: string[] = [];
    if (authRequest.scope) {
      const requestedScopes = authRequest.scope.split(',');
      const allowedScopes = mcpServer.scopes.map(s => s.scopeId);
      scopes = requestedScopes.filter(s => allowedScopes.includes(s));
    }

    // Find the existing MCP authorization flow for this client and server
    const mcpAuthFlow = await this.authJourneysService.findMcpAuthFlowByClientAndServer(
      client.id,
      mcpServer.id,
      ['authJourney']
    );

    if (!mcpAuthFlow) {
      throw new NotFoundException(
        `No authorization flow found for client '${authRequest.client_id}' and server '${serverIdentifier}'`,
      );
    }

    // Change status
    mcpAuthFlow.status = McpAuthorizationFlowStatus.AUTHORIZATION_REQUEST_STARTED;

    // Store the PKCE parameters and other OAuth request data
    mcpAuthFlow.codeChallenge = authRequest.code_challenge;
    mcpAuthFlow.codeChallengeMethod = authRequest.code_challenge_method;
    mcpAuthFlow.state = authRequest.state;
    mcpAuthFlow.redirectUri = authRequest.redirect_uri;
    mcpAuthFlow.resource = authRequest.resource;
    mcpAuthFlow.scope = scopes.join(',');

    await this.authJourneysService.saveMcpAuthFlow(mcpAuthFlow);

    // Return the flow ID to be used in the consent screen
    return mcpAuthFlow.id;
  }

  /**
   * Get authorization flow details for the consent screen
   */
  async getAuthorizationFlow(flowId: string): Promise<McpAuthorizationFlowEntity> {
    const mcpAuthFlow = await this.authJourneysService.findMcpAuthFlowById(
      flowId,
      ['server', 'client', 'authJourney']
    );

    if (!mcpAuthFlow) {
      throw new NotFoundException(`Authorization flow '${flowId}' not found`);
    }

    return mcpAuthFlow;
  }

  /**
   * Process user consent decision and generate authorization code
   * Returns redirect URL with authorization code or error
   */
  async processConsentDecision(
    consentDecision: ConsentDecisionDto,
    serverIdentifier: string,
    version: string,
  ): Promise<string> {
    // Fetch the flow using the flow_id as a CSRF protection token
    const mcpAuthFlow = await this.authJourneysService.findMcpAuthFlowById(
      consentDecision.flow_id,
      ['server', 'client']
    );

    if (!mcpAuthFlow) {
      throw new NotFoundException(`Authorization flow '${consentDecision.flow_id}' not found`);
    }

    // Verify the flow hasn't already been used (single-use protection)
    if (mcpAuthFlow.authorizationCode) {
      throw new UnauthorizedException('Authorization flow has already been completed');
    }

    // Verify the server matches
    if (mcpAuthFlow.server.providedId !== serverIdentifier) {
      throw new BadRequestException('Server identifier mismatch');
    }

    // Verify required PKCE parameters exist
    if (!mcpAuthFlow.codeChallenge || !mcpAuthFlow.redirectUri || !mcpAuthFlow.state) {
      throw new BadRequestException('Invalid flow state: missing required parameters');
    }

    // Handle denial
    if (!consentDecision.approved) {
      // Mark as rejected
      mcpAuthFlow.status = McpAuthorizationFlowStatus.USER_CONSENT_REJECTED;
      await this.authJourneysService.saveMcpAuthFlow(mcpAuthFlow);
      const errorUrl = new URL(mcpAuthFlow.redirectUri);
      errorUrl.searchParams.set('error', 'access_denied');
      errorUrl.searchParams.set('error_description', 'User denied the authorization request');
      errorUrl.searchParams.set('state', mcpAuthFlow.state);
      return errorUrl.toString();
    }
    // Mark as consent
    mcpAuthFlow.status = McpAuthorizationFlowStatus.USER_CONSENT_OK;
    await this.authJourneysService.saveMcpAuthFlow(mcpAuthFlow);

    // Process the next downstream flow (or complete if no connections)
    return this.processNextDownstreamFlow(mcpAuthFlow.authorizationJourneyId);
  }

  /**
   * Process the next downstream flow or complete MCP auth if all done
   * This method is called from both the consent handler and callback handler
   */
  private async processNextDownstreamFlow(journeyId: string): Promise<string> {
    // Get all connection flows for this journey
    const connectionFlows = await this.authJourneysService.getConnectionFlowsForJourney(
      journeyId,
      ['mcpConnection', 'mcpConnection.mappings', 'authJourney', 'authJourney.mcpAuthorizationFlow']
    );

    // If there are no connections, complete the MCP auth flow immediately
    if (connectionFlows.length === 0) {
      this.logger.log('No downstream connections to authorize, completing MCP auth');
      return this.completeMcpAuthFlow(journeyId);
    }

    // Find the next pending connection flow
    const nextPendingFlow = connectionFlows.find(flow => flow.status === 'pending');

    if (nextPendingFlow) {
      // Initiate OAuth for this ONE connection
      return this.initiateConnectionOAuth(nextPendingFlow);
    } else {
      // Check if all flows are authorized
      const allAuthorized = connectionFlows.every(flow => flow.status === 'authorized');
      const anyFailed = connectionFlows.some(flow => flow.status === 'failed');

      if (allAuthorized) {
        this.logger.log('All downstream connections authorized, completing MCP auth');
        return this.completeMcpAuthFlow(journeyId);
      } else if (anyFailed) {
        throw new BadRequestException('One or more downstream connections failed to authorize');
      } else {
        throw new BadRequestException('No pending connection flows found');
      }
    }
  }

  /**
   * Initiate OAuth for a single connection
   */
  private async initiateConnectionOAuth(connectionFlow: ConnectionAuthorizationFlowEntity): Promise<string> {
    const baseCallbackUrl = process.env.CALLBACK_BASE_URL || 'http://localhost:3000';
    const callbackUrl = `${baseCallbackUrl}/api/v1/auth/callback`;

    // Generate a unique state for this connection flow
    const state = randomBytes(32).toString('base64url');
    connectionFlow.state = state;
    connectionFlow.status = 'pending';

    await this.authJourneysService.saveConnectionFlow(connectionFlow);

    // Build the authorization URL
    const authUrl = new URL(connectionFlow.mcpConnection.authorizeUrl);
    authUrl.searchParams.set('client_id', connectionFlow.mcpConnection.clientId);
    authUrl.searchParams.set('redirect_uri', callbackUrl);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('state', state);

    // Add access_type=offline for Google to get refresh token
    authUrl.searchParams.set('access_type', 'offline');

    // Add prompt=consent to force consent screen (needed for refresh token)
    authUrl.searchParams.set('prompt', 'consent');

    // Map MCP scopes to downstream scopes
    const mcpAuthFlow = connectionFlow.authJourney?.mcpAuthorizationFlow;
    if (mcpAuthFlow?.scope && connectionFlow.mcpConnection.mappings) {
      // Get the scopes requested in the MCP flow
      const requestedScopes = mcpAuthFlow.scope.split(',').map(s => s.trim()).filter(s => s);

      // Filter mappings to only include requested scopes
      const relevantMappings = connectionFlow.mcpConnection.mappings.filter(
        mapping => requestedScopes.includes(mapping.scopeId)
      );

      // Extract downstream scopes
      const downstreamScopes = relevantMappings.map(m => m.downstreamScope);

      if (downstreamScopes.length > 0) {
        // Add scopes to the authorization URL (space-separated for OAuth)
        authUrl.searchParams.set('scope', downstreamScopes.join(' '));
        this.logger.log(`Requesting downstream scopes: ${downstreamScopes.join(', ')}`);
      }
    }

    this.logger.log(`Initiating downstream OAuth flow for connection ${connectionFlow.mcpConnection.friendlyName}`);
    this.logger.log(`Authorization URL: ${authUrl.toString()}`);

    // Return the authorization URL for redirect
    return authUrl.toString();
  }

  /**
   * Complete the MCP auth flow by issuing authorization code
   */
  private async completeMcpAuthFlow(journeyId: string): Promise<string> {
    // Get the MCP auth flow for this journey
    const mcpAuthFlow = await this.authJourneysService.findMcpAuthFlowByJourneyId(journeyId);

    if (!mcpAuthFlow) {
      throw new NotFoundException('MCP auth flow not found for journey');
    }

    if (!mcpAuthFlow.redirectUri || !mcpAuthFlow.state) {
      throw new BadRequestException('MCP auth flow missing redirect URI or state');
    }

    // Generate authorization code for the MCP client
    const authorizationCode = randomBytes(32).toString('base64url');
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 10);

    mcpAuthFlow.authorizationCode = authorizationCode;
    mcpAuthFlow.authorizationCodeExpiresAt = expiresAt;
    mcpAuthFlow.authorizationCodeUsed = false;
    mcpAuthFlow.status = McpAuthorizationFlowStatus.AUTHORIZATION_CODE_ISSUED;

    await this.authJourneysService.saveMcpAuthFlow(mcpAuthFlow);

    // Redirect back to the MCP client with the authorization code
    const redirectUrl = new URL(mcpAuthFlow.redirectUri);
    redirectUrl.searchParams.set('code', authorizationCode);
    redirectUrl.searchParams.set('state', mcpAuthFlow.state);

    return redirectUrl.toString();
  }

  /**
   * Handle callback from downstream OAuth provider
   */
  async handleDownstreamCallback(callbackRequest: CallbackRequestDto): Promise<string> {
    // Check for errors from the downstream provider
    if (callbackRequest.error) {
      this.logger.error(`Downstream auth failed: ${callbackRequest.error} - ${callbackRequest.error_description}`);
      throw new BadRequestException(
        `Downstream authorization failed: ${callbackRequest.error_description || callbackRequest.error}`
      );
    }

    // Find the connection flow by state
    const connectionFlow = await this.authJourneysService.findConnectionFlowByState(
      callbackRequest.state,
      ['mcpConnection', 'authJourney', 'authJourney.mcpAuthorizationFlow']
    );

    if (!connectionFlow) {
      throw new NotFoundException(`Connection flow not found for state: ${callbackRequest.state}`);
    }

    // Store the authorization code
    connectionFlow.authorizationCode = callbackRequest.code;

    // Exchange authorization code for access token
    await this.exchangeCodeForToken(connectionFlow);

    // Process the next downstream flow (or complete if all done)
    return this.processNextDownstreamFlow(connectionFlow.authorizationJourneyId);
  }

  /**
   * Exchange authorization code for access token with downstream provider
   */
  private async exchangeCodeForToken(connectionFlow: ConnectionAuthorizationFlowEntity): Promise<void> {
    const baseCallbackUrl = process.env.CALLBACK_BASE_URL || 'http://localhost:3000';
    const callbackUrl = `${baseCallbackUrl}/api/v1/auth/callback`;

    try {
      // Make the token exchange request
      const tokenResponse = await fetch(connectionFlow.mcpConnection.tokenUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          code: connectionFlow.authorizationCode!,
          redirect_uri: callbackUrl,
          client_id: connectionFlow.mcpConnection.clientId,
          client_secret: connectionFlow.mcpConnection.clientSecret,
        }),
      });

      if (!tokenResponse.ok) {
        const errorText = await tokenResponse.text();
        this.logger.error(`Token exchange failed: ${errorText}`);
        connectionFlow.status = 'failed';
        await this.authJourneysService.saveConnectionFlow(connectionFlow);
        throw new BadRequestException(`Token exchange failed: ${errorText}`);
      }

      const tokenData = await tokenResponse.json();

      // Store the tokens
      connectionFlow.accessToken = tokenData.access_token;
      connectionFlow.refreshToken = tokenData.refresh_token;

      if (tokenData.expires_in) {
        const expiresAt = new Date();
        expiresAt.setSeconds(expiresAt.getSeconds() + tokenData.expires_in);
        connectionFlow.tokenExpiresAt = expiresAt;
      }

      connectionFlow.status = 'authorized';
      await this.authJourneysService.saveConnectionFlow(connectionFlow);

      this.logger.log(`Successfully exchanged token for connection ${connectionFlow.mcpConnection.friendlyName}`);
    } catch (error) {
      this.logger.error(`Error exchanging token: ${error}`);
      connectionFlow.status = 'failed';
      await this.authJourneysService.saveConnectionFlow(connectionFlow);
      throw error;
    }
  }
}
