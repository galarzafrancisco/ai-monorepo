import { Injectable, NotFoundException, BadRequestException, UnauthorizedException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { randomBytes } from 'crypto';
import { RegisteredClientEntity } from './registered-client.entity';
import { AuthorizationRequestDto } from './dto/authorization-request.dto';
import { ConsentDecisionDto } from './dto/consent-decision.dto';
import { McpRegistryService } from 'src/mcp-registry/mcp-registry.service';
import { AuthJourneysService } from 'src/auth-journeys/auth-journeys.service';
import { McpAuthorizationFlowEntity } from 'src/auth-journeys/entities';
import { McpAuthorizationFlowStatus } from 'src/auth-journeys/enums/mcp-authorization-flow-status.enum';
import { auth } from '@modelcontextprotocol/sdk/client/auth.js';

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

    // Placeholder: Here we would handle any auth with downstream systems
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
}
