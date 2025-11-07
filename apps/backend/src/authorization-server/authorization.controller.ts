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
import { AuthorizationRequestDto } from './dto/authorization-request.dto';
import { ConsentDecisionDto } from './dto/consent-decision.dto';
import { McpAuthorizationFlowEntity } from 'src/auth-journeys/entities';

@ApiTags('Authorization Server')
@Controller('auth')
export class AuthorizationController {
  constructor(
    private readonly authorizationService: AuthorizationService,
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
      // In dev, UI runs on a different port; in prod, it's served from the same origin
      const uiPort = process.env.VITE_PORT;
      const consentUrl = uiPort
        ? `http://localhost:${uiPort}/consent?flow=${flowId}`
        : `/consent?flow=${flowId}`;
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
}
