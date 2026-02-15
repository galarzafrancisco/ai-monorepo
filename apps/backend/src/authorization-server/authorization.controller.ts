import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  Param,
  Res,
  Req,
  HttpStatus,
  BadRequestException,
  Logger,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBadRequestResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiUnauthorizedResponse,
  ApiCookieAuth,
} from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { AuthorizationService } from './authorization.service';
import { TokenService } from './token.service';
import { TokenExchangeService } from './token-exchange.service';
import { AuthorizationRequestDto } from './dto/authorization-request.dto';
import { ConsentDecisionDto } from './dto/consent-decision.dto';
import { TokenRequestDto } from './dto/token-request.dto';
import { TokenResponseDto } from './dto/token-response.dto';
import { IntrospectTokenRequestDto } from './dto/introspect-token-request.dto';
import { IntrospectTokenResponseDto } from './dto/introspect-token-response.dto';
import { TokenExchangeRequestDto } from './dto/token-exchange-request.dto';
import { TokenExchangeResponseDto } from './dto/token-exchange-response.dto';
import { CallbackRequestDto } from './dto/callback-request.dto';
import { GetConsentMetadataParamsDto } from './dto/consent-metadata-params.dto';
import { GetConsentMetadataResponseDto } from './dto/consent-metadata-response.dto';
import { ScopesResponseDto } from './dto/scope-response.dto';
import { ConsentMetadata } from './dto/service/authorization.service.types';
import { getFrontendPath } from '../config/frontend.config';
import { ALL_API_SCOPES } from '../auth/core/scopes/all-api.scopes';
import { AccessTokenGuard } from '../auth/guards/guards/access-token.guard';

@ApiTags('Authorization Server')
@Controller('auth')
export class AuthorizationController {
  private logger = new Logger(AuthorizationController.name);
  constructor(
    private readonly authorizationService: AuthorizationService,
    private readonly tokenService: TokenService,
    private readonly tokenExchangeService: TokenExchangeService,
  ) {}

  @Get('authorize/mcp/:serverIdentifier/:version')
  @ApiOperation({
    summary: 'OAuth 2.0 Authorization Endpoint',
    description:
      'Handles authorization requests from MCP clients. Validates the request, stores PKCE parameters, and redirects to the consent screen UI.',
  })
  @ApiResponse({
    status: HttpStatus.FOUND,
    description: 'Redirects to consent screen with authorization request ID',
  })
  @ApiBadRequestResponse({
    description: 'Invalid authorization request parameters',
  })
  @ApiNotFoundResponse({
    description: 'MCP server or client not found',
  })
  async authorize(
    @Query() authRequest: AuthorizationRequestDto,
    @Param('serverIdentifier') serverIdentifier: string,
    @Param('version') version: string,
    @Res() res: Response,
  ): Promise<void> {
    try {
      // Process the authorization request and get the flow ID
      const flowId =
        await this.authorizationService.processAuthorizationRequest(
          authRequest,
          serverIdentifier,
          version,
        );

      // Redirect to the consent screen with the flow ID
      // Use centralized frontend URL configuration
      const consentUrl = getFrontendPath(`/consent?flow=${flowId}`);
      res.redirect(HttpStatus.FOUND, consentUrl);
    } catch (error) {
      // If there's an error, redirect back with error parameters
      if (authRequest.redirect_uri) {
        const errorUrl = new URL(authRequest.redirect_uri);
        errorUrl.searchParams.set('error', 'server_error');
        errorUrl.searchParams.set(
          'error_description',
          error instanceof Error ? error.message : 'Unknown error',
        );
        if (authRequest.state) {
          errorUrl.searchParams.set('state', authRequest.state);
        }
        res.redirect(HttpStatus.FOUND, errorUrl.toString());
      } else {
        throw new BadRequestException(
          error instanceof Error
            ? error.message
            : 'Authorization request failed',
        );
      }
    }
  }

  @Post('authorize/mcp/:serverIdentifier/:version')
  @ApiOperation({
    summary: 'OAuth 2.0 Authorization Consent Handler',
    description:
      'Handles user consent decision. Validates the flow ID (CSRF token), generates an authorization code if approved, and redirects back to the client with the code or error.',
  })
  @ApiResponse({
    status: HttpStatus.FOUND,
    description:
      'Redirects to client redirect_uri with authorization code or error',
  })
  @ApiBadRequestResponse({
    description: 'Invalid consent decision or flow state',
  })
  @ApiNotFoundResponse({
    description: 'Authorization flow not found',
  })
  @ApiUnauthorizedResponse({
    description: 'Authorization flow has already been used',
  })
  async authorizeConsent(
    @Body() consentDecision: ConsentDecisionDto,
    @Param('serverIdentifier') serverIdentifier: string,
    @Param('version') version: string,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    try {
      const redirectUrl =
        await this.authorizationService.processConsentDecision(
          consentDecision,
          serverIdentifier,
          version,
          req,
        );

      this.logger.debug(`controller redirecting to ${redirectUrl}`);
      res.redirect(HttpStatus.FOUND, redirectUrl);
    } catch (error) {
      // If we can't redirect, throw the error
      throw new BadRequestException(
        error instanceof Error ? error.message : 'Consent processing failed',
      );
    }
  }

  @Get('consent/:flowId')
  @UseGuards(AccessTokenGuard)
  @ApiCookieAuth('JWT-Cookie')
  @ApiOperation({
    summary: 'Get metadata for the consent screen from flow ID',
    description: 'Retrieves authorization flow details for the consent screen',
  })
  @ApiOkResponse({
    description: 'Consent metadata retrieved successfully',
    type: GetConsentMetadataResponseDto,
  })
  @ApiUnauthorizedResponse({
    description: 'Authentication required to access consent metadata',
  })
  @ApiNotFoundResponse({
    description: 'Authorization flow not found',
  })
  async getConsentMetadata(
    @Param() params: GetConsentMetadataParamsDto,
  ): Promise<GetConsentMetadataResponseDto> {
    const consentMetadata =
      await this.authorizationService.getConsentMetadataFromFlowId(
        params.flowId,
      );
    return this.mapConsentMetadataToResponse(consentMetadata);
  }

  @Post('token/mcp/:serverIdentifier/:version')
  @ApiOperation({
    summary: 'OAuth 2.0 Token Endpoint',
    description:
      'Exchanges authorization code for access token. Validates PKCE code_verifier, issues signed JWT access token and refresh token.',
  })
  @ApiOkResponse({
    description: 'Access token issued successfully',
    type: TokenResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'Invalid token request parameters',
  })
  @ApiUnauthorizedResponse({
    description: 'Invalid authorization code, code_verifier, or expired code',
  })
  async token(
    @Body() tokenRequest: TokenRequestDto,
    @Param('serverIdentifier') serverIdentifier: string,
    @Param('version') version: string,
  ): Promise<TokenResponseDto> {
    return this.tokenService.exchangeAuthorizationCode(tokenRequest);
  }

  @Post('introspect/mcp/:serverIdentifier/:version')
  @ApiOperation({
    summary: 'OAuth 2.0 Token Introspection Endpoint',
    description:
      'Introspects an access token to validate it and retrieve its metadata. Verifies JWT signature, expiration, and claims according to RFC 7662.',
  })
  @ApiOkResponse({
    description:
      'Token introspection response (active true/false with metadata)',
    type: IntrospectTokenResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'Invalid introspection request parameters',
  })
  async introspect(
    @Body() introspectRequest: IntrospectTokenRequestDto,
    @Param('serverIdentifier') serverIdentifier: string,
    @Param('version') version: string,
  ): Promise<IntrospectTokenResponseDto> {
    // Map HTTP DTO to service input
    const serviceInput = {
      token: introspectRequest.token,
      token_type_hint: introspectRequest.token_type_hint,
      client_id: introspectRequest.client_id,
      client_secret: introspectRequest.client_secret,
    };

    // Call service with transport-agnostic types
    const result = await this.tokenService.introspectToken(serviceInput);

    // Short-circuit for inactive tokens - per RFC 7662, only 'active: false' is returned
    if (!result.active) {
      return { active: false };
    }

    // Map service result to HTTP DTO (TypeScript now knows all fields are present)
    const response: IntrospectTokenResponseDto = {
      active: result.active,
      token_type: result.token_type,
      client_id: result.client_id,
      sub: result.sub,
      aud: result.aud,
      iss: result.iss,
      jti: result.jti,
      exp: result.exp,
      iat: result.iat,
      scope: result.scope,
      mcp_server_identifier: result.mcp_server_identifier,
      resource: result.resource,
      version: result.version,
    };

    return response;
  }

  @Post('token-exchange/mcp/:serverIdentifier/:version')
  @ApiOperation({
    summary: 'RFC 8693 Token Exchange Endpoint',
    description:
      'Exchanges MCP JWT access token for downstream system tokens. Validates MCP token, resolves scope mappings, and returns downstream access token with automatic refresh if needed.',
  })
  @ApiOkResponse({
    description: 'Token exchange successful - returns downstream access token',
    type: TokenExchangeResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'Invalid token exchange request parameters',
  })
  @ApiUnauthorizedResponse({
    description: 'Invalid or expired MCP JWT',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Insufficient scope - requested scope not entitled',
  })
  @ApiNotFoundResponse({
    description: 'Connection not found',
  })
  async tokenExchange(
    @Body() tokenExchangeRequest: TokenExchangeRequestDto,
    @Param('serverIdentifier') serverIdentifier: string,
    @Param('version') version: string,
  ): Promise<TokenExchangeResponseDto> {
    return this.tokenExchangeService.exchangeToken(
      tokenExchangeRequest,
      serverIdentifier,
    );
  }

  @Get('callback')
  @ApiOperation({
    summary: 'OAuth 2.0 Callback Endpoint for Downstream Systems',
    description:
      'Handles callbacks from downstream OAuth providers. Validates the state, exchanges authorization code for tokens, and continues the auth flow.',
  })
  @ApiResponse({
    status: HttpStatus.FOUND,
    description: 'Redirects to next step in the authorization flow',
  })
  @ApiBadRequestResponse({
    description: 'Invalid callback parameters or state',
  })
  @ApiNotFoundResponse({
    description: 'Connection flow not found for provided state',
  })
  async callback(
    @Query() callbackRequest: CallbackRequestDto,
    @Res() res: Response,
  ): Promise<void> {
    try {
      const redirectUrl =
        await this.authorizationService.handleDownstreamCallback(
          callbackRequest,
        );
      res.redirect(HttpStatus.FOUND, redirectUrl);
    } catch (error) {
      // If there's an error, show an error page
      throw new BadRequestException(
        error instanceof Error ? error.message : 'Callback processing failed',
      );
    }
  }

  @Get('scopes')
  @ApiOperation({
    summary: 'List All Available Scopes',
    description:
      'Returns a list of all scopes available in the system. Each scope includes its identifier string and a human-readable description.',
  })
  @ApiOkResponse({
    description: 'List of all available scopes',
    type: ScopesResponseDto,
  })
  async getScopes(): Promise<ScopesResponseDto> {
    const scopes = await this.authorizationService.getAllAPIScopes();
    return { scopes };
  }

  private mapConsentMetadataToResponse(
    consentMetadata: ConsentMetadata,
  ): GetConsentMetadataResponseDto {
    return {
      id: consentMetadata.id,
      status: consentMetadata.status,
      scopes: consentMetadata.scopes,
      resource: consentMetadata.resource,
      server: consentMetadata.server,
      client: consentMetadata.client,
      redirectUri: consentMetadata.redirectUri,
      createdAt: consentMetadata.createdAt.toISOString(),
    };
  }
}
