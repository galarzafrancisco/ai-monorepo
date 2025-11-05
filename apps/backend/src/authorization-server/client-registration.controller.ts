import { Controller, Post, Get, Body, Param, HttpCode } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiCreatedResponse,
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiOkResponse,
  ApiNotFoundResponse,
} from '@nestjs/swagger';
import { ClientRegistrationService } from './client-registration.service';
import { RegisterClientDto } from './dto/register-client.dto';
import { ClientRegistrationResponseDto } from './dto/client-registration-response.dto';

@ApiTags('Authorization Server')
@Controller('authz/clients')
export class ClientRegistrationController {
  constructor(
    private readonly clientRegistrationService: ClientRegistrationService,
  ) {}

  @Post('register')
  @HttpCode(201)
  @ApiOperation({
    summary: 'Register a new OAuth 2.0 client (Dynamic Client Registration)',
    description:
      'Implements RFC 7591 Dynamic Client Registration for OAuth 2.0. Validates client metadata, generates credentials, and persists the client configuration. Requires authorization_code and refresh_token grant types with PKCE support per MCP specification.',
  })
  @ApiCreatedResponse({
    type: ClientRegistrationResponseDto,
    description: 'Client registered successfully with generated credentials',
  })
  @ApiBadRequestResponse({
    description:
      'Invalid client metadata (missing fields, invalid redirect URIs, unsupported grant types, or PKCE not configured)',
  })
  @ApiConflictResponse({
    description: 'A client with this name is already registered',
  })
  async registerClient(
    @Body() dto: RegisterClientDto,
  ): Promise<ClientRegistrationResponseDto> {
    const client = await this.clientRegistrationService.registerClient(dto);

    return {
      client_id: client.clientId,
      client_secret: client.clientSecret,
      client_name: client.clientName,
      redirect_uris: client.redirectUris,
      grant_types: client.grantTypes,
      token_endpoint_auth_method: client.tokenEndpointAuthMethod,
      scope: client.scopes,
      contacts: client.contacts,
      code_challenge_method: client.codeChallengeMethod,
      client_id_issued_at: client.createdAt.toISOString(),
    };
  }

  @Get(':clientId')
  @ApiOperation({
    summary: 'Retrieve client registration information',
    description:
      'Returns the registration metadata for a client. The client_secret is NOT included in the response for security reasons.',
  })
  @ApiOkResponse({
    type: ClientRegistrationResponseDto,
    description: 'Client registration information retrieved successfully',
  })
  @ApiNotFoundResponse({
    description: 'Client not found',
  })
  async getClient(
    @Param('clientId') clientId: string,
  ): Promise<ClientRegistrationResponseDto> {
    const client = await this.clientRegistrationService.getClient(clientId);

    return {
      client_id: client.clientId,
      client_secret: null, // Never return secret in GET requests
      client_name: client.clientName,
      redirect_uris: client.redirectUris,
      grant_types: client.grantTypes,
      token_endpoint_auth_method: client.tokenEndpointAuthMethod,
      scope: client.scopes,
      contacts: client.contacts,
      code_challenge_method: client.codeChallengeMethod,
      client_id_issued_at: client.createdAt.toISOString(),
    };
  }

  @Get()
  @ApiOperation({
    summary: 'List all registered clients (Admin)',
    description:
      'Returns a list of all registered OAuth clients. Intended for administrative purposes. Client secrets are not included.',
  })
  @ApiOkResponse({
    type: [ClientRegistrationResponseDto],
    description: 'List of registered clients',
  })
  async listClients(): Promise<ClientRegistrationResponseDto[]> {
    const clients = await this.clientRegistrationService.listClients();

    return clients.map((client) => ({
      client_id: client.clientId,
      client_secret: null,
      client_name: client.clientName,
      redirect_uris: client.redirectUris,
      grant_types: client.grantTypes,
      token_endpoint_auth_method: client.tokenEndpointAuthMethod,
      scope: client.scopes,
      contacts: client.contacts,
      code_challenge_method: client.codeChallengeMethod,
      client_id_issued_at: client.createdAt.toISOString(),
    }));
  }
}
