import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiCookieAuth,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { AccessTokenGuard } from '../auth/guards/guards/access-token.guard';
import { ScopesGuard } from '../auth/guards/guards/scopes.guard';
import { RequireScopes } from '../auth/guards/decorators/require-scopes.decorator';
import { CurrentUser } from '../auth/guards/decorators/current-user.decorator';
import type { UserContext } from '../auth/guards/context/auth-context.types';
import { AiProvidersScopes } from './ai-providers.scopes';
import { ChatgptConnectionsService } from './chatgpt-subscription/chatgpt-connections.service';
import {
  AiProviderConnectionResponseDto,
  CompleteAiProviderAuthorizationDto,
  DisconnectAiProviderResponseDto,
  StartAiProviderAuthorizationResponseDto,
  UpdateAiProviderConnectionDto,
} from './dto/http/ai-provider-connection.dto';
import { AiProviderParamsDto } from './dto/http/ai-provider-params.dto';
import {
  AiProviderConnectionResult,
  CompleteAiProviderAuthorizationInput,
} from './dto/service/ai-providers.service.types';
import { AiProviderAuthorizationFailedError } from './errors/ai-providers.errors';

/**
 * The caller's own connection to an AI provider that runs on personal plans.
 * Every route acts on the signed-in user's connection and nobody else's.
 */
@ApiTags('AI Provider Connections')
@ApiCookieAuth('JWT-Cookie')
@Controller('ai-providers/:id/connection')
@UseGuards(AccessTokenGuard, ScopesGuard)
export class AiProviderConnectionsController {
  constructor(private readonly connections: ChatgptConnectionsService) {}

  @Get()
  @RequireScopes(AiProvidersScopes.READ.id)
  @ApiOperation({ summary: 'Get your own connection to the provider' })
  @ApiOkResponse({ type: AiProviderConnectionResponseDto })
  @ApiNotFoundResponse({ description: 'AI provider not found' })
  async getConnection(
    @Param() params: AiProviderParamsDto,
    @CurrentUser() user: UserContext,
  ): Promise<AiProviderConnectionResponseDto> {
    return this.mapToResponse(
      await this.connections.getConnection(params.id, user.actorId),
    );
  }

  @Post('authorize')
  @RequireScopes(AiProvidersScopes.CONNECT.id)
  @ApiOperation({
    summary: 'Start signing in to the provider with your own account',
  })
  @ApiCreatedResponse({ type: StartAiProviderAuthorizationResponseDto })
  async startAuthorization(
    @Param() params: AiProviderParamsDto,
    @CurrentUser() user: UserContext,
  ): Promise<StartAiProviderAuthorizationResponseDto> {
    const result = await this.connections.startAuthorization(
      params.id,
      user.actorId,
    );
    return {
      authorizationUrl: result.authorizationUrl,
      expiresAt: result.expiresAt.toISOString(),
    };
  }

  @Post('callback')
  @RequireScopes(AiProvidersScopes.CONNECT.id)
  @ApiOperation({
    summary: 'Finish the sign-in you started with what the provider sent back',
  })
  @ApiCreatedResponse({ type: AiProviderConnectionResponseDto })
  async completeAuthorization(
    @Param() params: AiProviderParamsDto,
    @Body() dto: CompleteAiProviderAuthorizationDto,
    @CurrentUser() user: UserContext,
  ): Promise<AiProviderConnectionResponseDto> {
    const result = await this.connections.completeAuthorization(
      params.id,
      user.actorId,
      this.toCallback(dto),
    );
    return this.mapToResponse(result);
  }

  @Patch()
  @RequireScopes(AiProvidersScopes.CONNECT.id)
  @ApiOperation({ summary: 'Change what your connection may be used for' })
  @ApiOkResponse({ type: AiProviderConnectionResponseDto })
  async updateConnection(
    @Param() params: AiProviderParamsDto,
    @Body() dto: UpdateAiProviderConnectionDto,
    @CurrentUser() user: UserContext,
  ): Promise<AiProviderConnectionResponseDto> {
    const result = await this.connections.setAutomatedTurnsAllowed(
      params.id,
      user.actorId,
      dto.automatedTurnsAllowed,
    );
    return this.mapToResponse(result);
  }

  @Delete()
  @RequireScopes(AiProvidersScopes.CONNECT.id)
  @ApiOperation({
    summary: 'Disconnect your account and revoke its grant at the provider',
  })
  @ApiOkResponse({ type: DisconnectAiProviderResponseDto })
  async disconnect(
    @Param() params: AiProviderParamsDto,
    @CurrentUser() user: UserContext,
  ): Promise<DisconnectAiProviderResponseDto> {
    return this.connections.disconnect(params.id, user.actorId);
  }

  /** Accepts the pasted redirect address or its separate query parameters. */
  private toCallback(
    dto: CompleteAiProviderAuthorizationDto,
  ): CompleteAiProviderAuthorizationInput {
    let query: URLSearchParams | null = null;
    let redirectAddress: string | null = null;
    if (dto.callbackUrl?.trim()) {
      try {
        const pasted = new URL(dto.callbackUrl.trim());
        query = pasted.searchParams;
        redirectAddress = `${pasted.origin}${pasted.pathname}`;
      } catch {
        throw new AiProviderAuthorizationFailedError(
          'That is not a complete address. Copy everything in the address bar, starting with http://127.0.0.1.',
        );
      }
    }

    const state = query?.get('state') ?? dto.state;
    if (!state) {
      throw new AiProviderAuthorizationFailedError(
        'The address has no state value, so it cannot be matched to a sign-in. Start again.',
      );
    }

    return {
      state,
      redirectAddress,
      code: query?.get('code') ?? dto.code ?? null,
      clientId: query?.get('client_id') ?? dto.clientId ?? null,
      error: query?.get('error') ?? dto.error ?? null,
      errorDescription:
        query?.get('error_description') ?? dto.errorDescription ?? null,
    };
  }

  private mapToResponse(
    result: AiProviderConnectionResult,
  ): AiProviderConnectionResponseDto {
    return {
      aiProviderId: result.aiProviderId,
      status: result.status,
      accountEmail: result.accountEmail,
      canUsePlan: result.canUsePlan,
      automatedTurnsAllowed: result.automatedTurnsAllowed,
      isAuthorizationPending: result.isAuthorizationPending,
      lastErrorCode: result.lastErrorCode,
      lastErrorAt: result.lastErrorAt?.toISOString() ?? null,
      manageUsageUrl: result.manageUsageUrl,
    };
  }
}
