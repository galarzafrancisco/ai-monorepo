import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import {
  ApiCookieAuth,
  ApiCreatedResponse,
  ApiNoContentResponse,
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
import { GithubConnectionsService } from './github-connections.service';
import { IntegrationsScopes } from './integrations.scopes';
import { CreateGithubConnectionDto } from './dto/http/create-github-connection.dto';
import { UpdateGithubConnectionDto } from './dto/http/update-github-connection.dto';
import { GithubConnectionParamsDto } from './dto/http/github-connection-params.dto';
import { GithubConnectionResponseDto } from './dto/http/github-connection-response.dto';
import {
  GithubWebhookSettingsResponseDto,
  GithubWebhookSourceDto,
} from './dto/http/github-webhook-settings-response.dto';
import {
  ResolveGithubConnectionQueryDto,
  ResolvedGithubConnectionResponseDto,
} from './dto/http/resolve-github-connection.dto';
import { GithubConnectionResult, GithubWebhookSource } from './dto/service/github-connections.service.types';
import { parseGithubRepoUrl } from './github/github-repo-ref';

@ApiTags('Integrations - GitHub')
@ApiCookieAuth('JWT-Cookie')
@Controller('integrations/github/connections')
@UseGuards(AccessTokenGuard, ScopesGuard)
export class GithubConnectionsController {
  constructor(private readonly connections: GithubConnectionsService) {}

  @Post()
  @RequireScopes(IntegrationsScopes.WRITE.id)
  @ApiOperation({ summary: 'Connect GitHub with a personal access token or a GitHub App installation' })
  @ApiCreatedResponse({ type: GithubConnectionResponseDto })
  async createConnection(
    @Body() dto: CreateGithubConnectionDto,
    @CurrentUser() user: UserContext,
  ): Promise<GithubConnectionResponseDto> {
    const result = await this.connections.createConnection({
      name: dto.name,
      authType: dto.authType,
      secret: dto.secret,
      appId: dto.appId,
      installationId: dto.installationId,
      owners: dto.owners,
      createdByActorId: user.actorId,
    });
    return this.mapToResponse(result);
  }

  @Get()
  @RequireScopes(IntegrationsScopes.READ.id)
  @ApiOperation({ summary: 'List GitHub connections' })
  @ApiOkResponse({ type: [GithubConnectionResponseDto] })
  async listConnections(): Promise<GithubConnectionResponseDto[]> {
    const results = await this.connections.listConnections();
    return results.map((result) => this.mapToResponse(result));
  }

  @Get('resolve')
  @RequireScopes(IntegrationsScopes.READ.id)
  @ApiOperation({ summary: 'Which connection Taico would use for a repository, and why' })
  @ApiOkResponse({ type: ResolvedGithubConnectionResponseDto })
  async resolveConnection(
    @Query() query: ResolveGithubConnectionQueryDto,
  ): Promise<ResolvedGithubConnectionResponseDto> {
    const repository = parseGithubRepoUrl(query.repoUrl);
    if (!repository) return { repository: null, connection: null, match: null, webhook: null };
    const resolved = await this.connections.resolveForRepository({
      owner: repository.owner,
      projectConnectionId: query.connectionId,
    });
    return {
      repository,
      connection: resolved ? this.mapToResponse(resolved.connection) : null,
      match: resolved?.match ?? null,
      webhook: mapWebhookSource(await this.connections.findWebhookCoverage(repository.owner, repository.repo)),
    };
  }

  @Get(':id')
  @RequireScopes(IntegrationsScopes.READ.id)
  @ApiOperation({ summary: 'Get a GitHub connection' })
  @ApiOkResponse({ type: GithubConnectionResponseDto })
  @ApiNotFoundResponse({ description: 'GitHub connection not found' })
  async getConnection(@Param() params: GithubConnectionParamsDto): Promise<GithubConnectionResponseDto> {
    return this.mapToResponse(await this.connections.getConnection(params.id));
  }

  @Patch(':id')
  @RequireScopes(IntegrationsScopes.WRITE.id)
  @ApiOperation({ summary: 'Update a GitHub connection; a new credential is checked with GitHub before it is saved' })
  @ApiOkResponse({ type: GithubConnectionResponseDto })
  @ApiNotFoundResponse({ description: 'GitHub connection not found' })
  async updateConnection(
    @Param() params: GithubConnectionParamsDto,
    @Body() dto: UpdateGithubConnectionDto,
  ): Promise<GithubConnectionResponseDto> {
    const result = await this.connections.updateConnection(params.id, {
      name: dto.name,
      secret: dto.secret,
      appId: dto.appId,
      installationId: dto.installationId,
      owners: dto.owners,
    });
    return this.mapToResponse(result);
  }

  @Post(':id/verify')
  @HttpCode(200)
  @RequireScopes(IntegrationsScopes.WRITE.id)
  @ApiOperation({ summary: 'Check the stored credential with GitHub again' })
  @ApiOkResponse({ type: GithubConnectionResponseDto })
  @ApiNotFoundResponse({ description: 'GitHub connection not found' })
  async verifyConnection(@Param() params: GithubConnectionParamsDto): Promise<GithubConnectionResponseDto> {
    return this.mapToResponse(await this.connections.verifyConnection(params.id));
  }

  @Get(':id/webhook')
  @RequireScopes(IntegrationsScopes.WRITE.id)
  @ApiOperation({
    summary: 'Webhook address and secret for the connection (the secret is created on first request)',
  })
  @ApiOkResponse({ type: GithubWebhookSettingsResponseDto })
  @ApiNotFoundResponse({ description: 'GitHub connection not found' })
  async getWebhookSettings(
    @Param() params: GithubConnectionParamsDto,
    @CurrentUser() user: UserContext,
  ): Promise<GithubWebhookSettingsResponseDto> {
    const settings = await this.connections.getWebhookSettings(params.id, user.actorId);
    return {
      url: settings.url,
      secret: settings.secret,
      lastDeliveryAt: settings.lastDeliveryAt?.toISOString() ?? null,
      sources: settings.sources.map((source) => mapWebhookSource(source)!),
    };
  }

  @Delete(':id')
  @HttpCode(204)
  @RequireScopes(IntegrationsScopes.DELETE.id)
  @ApiOperation({ summary: 'Delete a GitHub connection and its stored credential' })
  @ApiNoContentResponse({ description: 'Deleted' })
  @ApiNotFoundResponse({ description: 'GitHub connection not found' })
  async deleteConnection(@Param() params: GithubConnectionParamsDto): Promise<void> {
    await this.connections.deleteConnection(params.id);
  }

  private mapToResponse(result: GithubConnectionResult): GithubConnectionResponseDto {
    return {
      id: result.id,
      name: result.name,
      authType: result.authType,
      appId: result.appId,
      installationId: result.installationId,
      owners: result.owners,
      accountLogin: result.accountLogin,
      lastVerifiedAt: result.lastVerifiedAt?.toISOString() ?? null,
      lastError: result.lastError,
      lastWebhookAt: result.lastWebhookAt?.toISOString() ?? null,
      rowVersion: result.rowVersion,
      createdAt: result.createdAt.toISOString(),
      updatedAt: result.updatedAt.toISOString(),
    };
  }
}

function mapWebhookSource(source: GithubWebhookSource | null): GithubWebhookSourceDto | null {
  if (!source) return null;
  return {
    owner: source.owner,
    repo: source.repo,
    lastDeliveryAt: source.lastDeliveryAt.toISOString(),
    lastEvent: source.lastEvent,
    active: source.active,
  };
}
