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

    // Handle downstream auth flows for connections
    const connectionFlows = await this.authJourneysService.getConnectionFlowsForJourney(
      mcpAuthFlow.authorizationJourneyId,
      ['mcpConnection']
    );

    // If there are no connections, we can skip downstream auth
    if (connectionFlows.length === 0) {
      this.logger.log('No downstream connections to authorize');
    } else {
      // Mark as waiting for downstream auth
      mcpAuthFlow.status = McpAuthorizationFlowStatus.WAITING_ON_DOWNSTREAM_AUTH;
      await this.authJourneysService.saveMcpAuthFlow(mcpAuthFlow);

      // Initiate OAuth flows for each connection
      await this.initiateDownstreamAuthFlows(connectionFlows, mcpAuthFlow);

      // Return a redirect to a "waiting" page that will poll for completion
      // For now, we'll just wait synchronously (TODO: make this async with polling)
      const redirectUrl = new URL(mcpAuthFlow.redirectUri);
      redirectUrl.searchParams.set('state', mcpAuthFlow.state);
      redirectUrl.searchParams.set('flow_id', mcpAuthFlow.id);
      return redirectUrl.toString();
    }

    mcpAuthFlow.status = McpAuthorizationFlowStatus.WAITING_ON_DOWNSTREAM_AUTH;
    await this.authJourneysService.saveMcpAuthFlow(mcpAuthFlow);

    // Generate authorization code (cryptographically secure random string)
    const authorizationCode = randomBytes(32).toString('base64url');

    // Set expiry (10 minutes from now, per OAuth 2.0 best practices)
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 10);

    // Store the authorization code
    mcpAuthFlow.authorizationCode = authorizationCode;
    mcpAuthFlow.authorizationCodeExpiresAt = expiresAt;
    mcpAuthFlow.authorizationCodeUsed = false;

    // Update status
    mcpAuthFlow.status = McpAuthorizationFlowStatus.AUTHORIZATION_CODE_ISSUED;

    await this.authJourneysService.saveMcpAuthFlow(mcpAuthFlow);

    // Build redirect URL with authorization code
    const redirectUrl = new URL(mcpAuthFlow.redirectUri);
    redirectUrl.searchParams.set('code', authorizationCode);
    redirectUrl.searchParams.set('state', mcpAuthFlow.state);

    return redirectUrl.toString();
  }

  /**
   * Initiate OAuth flows for all downstream connections
   */
  private async initiateDownstreamAuthFlows(
    connectionFlows: ConnectionAuthorizationFlowEntity[],
    mcpAuthFlow: McpAuthorizationFlowEntity
  ): Promise<void> {
    const baseCallbackUrl = process.env.CALLBACK_BASE_URL || 'http://localhost:3000';
    const callbackUrl = `${baseCallbackUrl}/api/v1/auth/callback`;

    for (const connectionFlow of connectionFlows) {
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

      // Add scope if the connection has scope mappings
      // For now, we'll skip this and add it later if needed

      this.logger.log(`Initiating downstream OAuth flow for connection ${connectionFlow.mcpConnection.friendlyName}`);
      this.logger.log(`Authorization URL: ${authUrl.toString()}`);

      // In a real implementation, we would redirect the user to this URL
      // For now, we'll just log it and mark the flow as needing user action
      // TODO: Implement proper redirect handling with return URL tracking
    }
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

    // Check if all connection flows are complete
    const allConnectionFlows = await this.authJourneysService.getConnectionFlowsForJourney(
      connectionFlow.authorizationJourneyId,
      ['authJourney', 'authJourney.mcpAuthorizationFlow']
    );

    const allComplete = allConnectionFlows.every(flow => flow.status === 'authorized');

    if (allComplete) {
      this.logger.log('All downstream connections authorized, completing MCP auth flow');

      // Get the MCP auth flow
      const mcpAuthFlow = connectionFlow.authJourney.mcpAuthorizationFlow;

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
    } else {
      // Still waiting on other connections
      // TODO: Redirect to a waiting page or the next auth URL
      this.logger.log('Waiting on other downstream connections');

      // For now, return a simple success message
      // In a real implementation, we'd redirect to the next connection's auth URL
      return '/auth-in-progress';
    }
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
