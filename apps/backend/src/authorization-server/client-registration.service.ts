import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RegisteredClientEntity } from './registered-client.entity';
import { RegisterClientDto } from './dto/register-client.dto';
import { GrantType, TokenEndpointAuthMethod } from './enums';
import {
  InvalidGrantTypeError,
  InvalidRedirectUriError,
  PkceRequiredError,
  MissingRequiredFieldError,
  ClientAlreadyRegisteredError,
  ClientNotFoundError,
} from './errors/client-registration.errors';
import { randomBytes } from 'crypto';

@Injectable()
export class ClientRegistrationService {
  constructor(
    @InjectRepository(RegisteredClientEntity)
    private readonly clientRepository: Repository<RegisteredClientEntity>,
  ) {}

  /**
   * Register a new OAuth 2.0 client with Dynamic Client Registration
   * Validates all requirements per RFC 7591/7592 and MCP specification
   */
  async registerClient(
    dto: RegisterClientDto,
  ): Promise<RegisteredClientEntity> {
    // Validate required fields
    this.validateRequiredFields(dto);

    // Validate grant types - must include authorization_code and refresh_token per MCP
    this.validateGrantTypes(dto.grant_types);

    // Validate redirect URIs
    this.validateRedirectUris(dto.redirect_uris);

    // Validate PKCE requirement for authorization_code
    this.validatePkceRequirement(dto);

    // Check for duplicate client names (idempotency check)
    const existingClient = await this.clientRepository.findOne({
      where: { clientName: dto.client_name },
    });

    if (existingClient) {
      throw new ClientAlreadyRegisteredError(dto.client_name);
    }

    // Generate secure client credentials
    const clientId = this.generateClientId();
    const clientSecret =
      dto.token_endpoint_auth_method !== TokenEndpointAuthMethod.NONE
        ? this.generateClientSecret()
        : null;

    // Create and persist the client entity
    const client = this.clientRepository.create({
      clientId,
      clientSecret: clientSecret ? this.hashSecret(clientSecret) : null,
      clientName: dto.client_name,
      redirectUris: dto.redirect_uris,
      grantTypes: dto.grant_types,
      tokenEndpointAuthMethod: dto.token_endpoint_auth_method,
      scopes: dto.scope || null,
      contacts: dto.contacts || null,
      codeChallengeMethod: dto.code_challenge_method || null,
    });

    const savedClient = await this.clientRepository.save(client);

    // Return the client with the plaintext secret (only time it's exposed)
    return {
      ...savedClient,
      clientSecret,
    };
  }

  /**
   * Retrieve a registered client by client_id
   */
  async getClient(clientId: string): Promise<RegisteredClientEntity> {
    const client = await this.clientRepository.findOne({
      where: { clientId },
    });

    if (!client) {
      throw new ClientNotFoundError(clientId);
    }

    return client;
  }

  /**
   * List all registered clients (for admin purposes)
   */
  async listClients(): Promise<RegisteredClientEntity[]> {
    return this.clientRepository.find({
      order: { createdAt: 'DESC' },
    });
  }

  // Validation methods

  private validateRequiredFields(dto: RegisterClientDto): void {
    if (!dto.client_name) {
      throw new MissingRequiredFieldError('client_name');
    }
    if (!dto.redirect_uris || dto.redirect_uris.length === 0) {
      throw new MissingRequiredFieldError('redirect_uris');
    }
    if (!dto.grant_types || dto.grant_types.length === 0) {
      throw new MissingRequiredFieldError('grant_types');
    }
    if (!dto.token_endpoint_auth_method) {
      throw new MissingRequiredFieldError('token_endpoint_auth_method');
    }
  }

  private validateGrantTypes(grantTypes: GrantType[]): void {
    // Per MCP requirements: must include both authorization_code and refresh_token
    if (!grantTypes.includes(GrantType.AUTHORIZATION_CODE)) {
      throw new InvalidGrantTypeError(
        'authorization_code grant type is required per MCP specification',
      );
    }

    if (!grantTypes.includes(GrantType.REFRESH_TOKEN)) {
      throw new InvalidGrantTypeError(
        'refresh_token grant type is required per MCP specification',
      );
    }
  }

  private validateRedirectUris(redirectUris: string[]): void {
    if (redirectUris.length === 0) {
      throw new InvalidRedirectUriError('At least one redirect URI is required');
    }

    // More lax validation for MCP clients - allow localhost and http
    for (const uri of redirectUris) {
      try {
        const url = new URL(uri);

        // Just validate it's a valid URI, no protocol restrictions
        // MCP clients can use localhost and http URIs
      } catch {
        throw new InvalidRedirectUriError(`Invalid URI format: ${uri}`);
      }
    }
  }

  private validatePkceRequirement(dto: RegisterClientDto): void {
    // If using authorization_code, PKCE is required
    if (dto.grant_types.includes(GrantType.AUTHORIZATION_CODE)) {
      if (!dto.code_challenge_method) {
        throw new PkceRequiredError();
      }

      // Only S256 is allowed for security
      if (dto.code_challenge_method !== 'S256') {
        throw new PkceRequiredError();
      }
    }
  }

  // Credential generation methods

  private generateClientId(): string {
    return randomBytes(16).toString('hex');
  }

  private generateClientSecret(): string {
    const secretLength = parseInt(
      process.env.CLIENT_SECRET_LENGTH || '32',
      10,
    );
    return randomBytes(secretLength).toString('base64url');
  }

  private hashSecret(secret: string): string {
    // In a production system, use bcrypt or similar
    // For now, we'll store it directly (NOT RECOMMENDED FOR PRODUCTION)
    // TODO: Implement proper secret hashing with bcrypt
    return secret;
  }
}
