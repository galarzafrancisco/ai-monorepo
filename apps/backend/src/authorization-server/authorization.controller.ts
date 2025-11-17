import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  Param,
  Res,
  HttpStatus,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBadRequestResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { AuthorizationService } from './authorization.service';
import { TokenService } from './token.service';
import { AuthorizationRequestDto } from './dto/authorization-request.dto';
import { ConsentDecisionDto } from './dto/consent-decision.dto';
import { TokenRequestDto } from './dto/token-request.dto';
import { TokenResponseDto } from './dto/token-response.dto';
import { IntrospectTokenRequestDto } from './dto/introspect-token-request.dto';
import { IntrospectTokenResponseDto } from './dto/introspect-token-response.dto';
import { CallbackRequestDto } from './dto/callback-request.dto';
import { McpAuthorizationFlowEntity } from 'src/auth-journeys/entities';
import { getFrontendPath } from '../config/frontend.config';

@ApiTags('Authorization Server')
@Controller('auth')
export class AuthorizationController {
  private logger = new Logger(AuthorizationController.name);
  constructor(
    private readonly authorizationService: AuthorizationService,
    private readonly tokenService: TokenService,
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
      const flowId = await this.authorizationService.processAuthorizationRequest(
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
        errorUrl.searchParams.set('error_description', error instanceof Error ? error.message : 'Unknown error');
        if (authRequest.state) {
          errorUrl.searchParams.set('state', authRequest.state);
        }
        res.redirect(HttpStatus.FOUND, errorUrl.toString());
      } else {
        throw new BadRequestException(error instanceof Error ? error.message : 'Authorization request failed');
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
    description: 'Redirects to client redirect_uri with authorization code or error',
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
    @Res() res: Response,
  ): Promise<void> {
    try {
      const redirectUrl = await this.authorizationService.processConsentDecision(
        consentDecision,
        serverIdentifier,
        version,
      );

      this.logger.debug(`controller redirecting to ${redirectUrl}`);
      res.redirect(HttpStatus.FOUND, redirectUrl);
    } catch (error) {
      // If we can't redirect, throw the error
      throw new BadRequestException(error instanceof Error ? error.message : 'Consent processing failed');
    }
  }

  @Get('flow/:flowId')
  @ApiOperation({
    summary: 'Get authorization flow details',
    description: 'Retrieves authorization flow details for the consent screen',
  })
  @ApiOkResponse({
    description: 'Authorization flow details retrieved successfully',
    type: McpAuthorizationFlowEntity,
  })
  @ApiNotFoundResponse({
    description: 'Authorization flow not found',
  })
  async getFlow(
    @Param('flowId') flowId: string,
  ): Promise<McpAuthorizationFlowEntity> {
    return this.authorizationService.getAuthorizationFlow(flowId);
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
    description: 'Token introspection response (active true/false with metadata)',
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
    return this.tokenService.introspectToken(introspectRequest);
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
      const redirectUrl = await this.authorizationService.handleDownstreamCallback(callbackRequest);
      res.redirect(HttpStatus.FOUND, redirectUrl);
    } catch (error) {
      // If there's an error, show an error page
      throw new BadRequestException(error instanceof Error ? error.message : 'Callback processing failed');
    }
  }
}
