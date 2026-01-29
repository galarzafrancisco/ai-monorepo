import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiOkResponse,
  ApiCreatedResponse,
  ApiCookieAuth,
  ApiParam,
} from '@nestjs/swagger';
import { AgentsService } from './agents.service';
import { ActorService } from '../identity-provider/actor.service';
import { IssuedAccessTokenService } from '../authorization-server/issued-access-token.service';
import { AccessTokenGuard } from '../auth/guards/guards/access-token.guard';
import { ScopesGuard } from '../auth/guards/guards/scopes.guard';
import { RequireScopes } from '../auth/guards/decorators/require-scopes.decorator';
import { CurrentUser } from '../auth/guards/decorators/current-user.decorator';
import type { UserContext } from '../auth/guards/context/auth-context.types';
import { ActorType } from '../identity-provider/enums';
import { AgentsScopes } from './agents.scopes';
import { IssueAccessTokenRequestDto } from '../authorization-server/dto/issue-access-token-request.dto';
import { IssueAccessTokenResponseDto } from '../authorization-server/dto/issue-access-token-response.dto';
import { IssuedAccessTokenResponseDto } from '../authorization-server/dto/issued-access-token-response.dto';

/**
 * Controller for managing agent access tokens.
 * Only humans can issue tokens for agents.
 */
@ApiTags('Agent Tokens')
@ApiCookieAuth('JWT-Cookie')
@Controller('agents/:slug/tokens')
@UseGuards(AccessTokenGuard, ScopesGuard)
@RequireScopes(AgentsScopes.WRITE.id)
export class AgentTokensController {
  constructor(
    private readonly agentsService: AgentsService,
    private readonly actorService: ActorService,
    private readonly issuedAccessTokenService: IssuedAccessTokenService,
  ) {}

  /**
   * Issue a new access token for an agent.
   * Only humans can issue tokens.
   */
  @Post()
  @ApiOperation({ summary: 'Issue a new access token for an agent' })
  @ApiParam({ name: 'slug', description: 'Agent slug' })
  @ApiCreatedResponse({ type: IssueAccessTokenResponseDto })
  async issueToken(
    @Param('slug') slug: string,
    @Body() dto: IssueAccessTokenRequestDto,
    @CurrentUser() user: UserContext,
  ): Promise<IssueAccessTokenResponseDto> {
    // TODO: This is a controller. There's a bunch of logic here that belongs in a service.
    // TODO: Fine for now, but we need tighter controls of who can issue what tokens

    // Only humans can issue tokens
    if (user.actorType !== ActorType.HUMAN) {
      throw new ForbiddenException('Only humans can issue tokens for agents');
    }

    // Get the agent (validates it exists)
    const agent = await this.agentsService.getAgentBySlug({ slug });

    // Get the subject actor (agent's actor)
    const subjectActor = await this.actorService.getActorById(agent.actorId);
    if (!subjectActor) {
      throw new NotFoundException('Agent actor not found');
    }

    // Get the issuing user's actor
    const issuedByActor = await this.actorService.getActorById(user.actorId);
    if (!issuedByActor) {
      throw new NotFoundException('Issuing user actor not found');
    }

    // Issue the token
    const result = await this.issuedAccessTokenService.issueToken({
      subjectActor,
      issuedByActor,
      name: dto.name,
      scopes: dto.scopes,
      expirationDays: dto.expirationDays,
    });

    return {
      id: result.entity.id,
      name: result.entity.name,
      token: result.token, // Only shown once!
      scopes: result.entity.scopes,
      expiresAt: result.entity.expiresAt.toISOString(),
      createdAt: result.entity.createdAt.toISOString(),
    };
  }

  /**
   * List all tokens issued for an agent.
   */
  @Get()
  @RequireScopes(AgentsScopes.READ.id)
  @ApiOperation({ summary: 'List all tokens for an agent' })
  @ApiParam({ name: 'slug', description: 'Agent slug' })
  @ApiOkResponse({ type: [IssuedAccessTokenResponseDto] })
  async listTokens(
    @Param('slug') slug: string,
  ): Promise<IssuedAccessTokenResponseDto[]> {
    // Get the agent (validates it exists)
    const agent = await this.agentsService.getAgentBySlug({ slug });

    // Get all tokens for this agent
    const tokens = await this.issuedAccessTokenService.listTokensForSubject(
      agent.actorId,
    );

    return tokens.map((token) => ({
      id: token.id,
      name: token.name,
      scopes: token.scopes,
      sub: token.subjectActorId,
      subjectSlug: token.subjectActor?.slug ?? 'unknown',
      subjectDisplayName: token.subjectActor?.displayName ?? 'Unknown',
      issuedBy: token.issuedByActorId,
      issuedByDisplayName: token.issuedByActor?.displayName ?? 'Unknown',
      expiresAt: token.expiresAt.toISOString(),
      createdAt: token.createdAt.toISOString(),
      revokedAt: token.revokedAt?.toISOString() ?? null,
      lastUsedAt: token.lastUsedAt?.toISOString() ?? null,
      isValid: token.isValid,
    }));
  }

  /**
   * Revoke a specific token.
   */
  @Delete(':tokenId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Revoke an agent token' })
  @ApiParam({ name: 'slug', description: 'Agent slug' })
  @ApiParam({ name: 'tokenId', description: 'Token ID to revoke' })
  @ApiOkResponse({ type: IssuedAccessTokenResponseDto })
  async revokeToken(
    @Param('slug') slug: string,
    @Param('tokenId') tokenId: string,
    @CurrentUser() user: UserContext,
  ): Promise<IssuedAccessTokenResponseDto> {
    // Only humans can revoke tokens
    if (user.actorType !== ActorType.HUMAN) {
      throw new ForbiddenException('Only humans can revoke tokens');
    }

    // Get the agent (validates it exists)
    const agent = await this.agentsService.getAgentBySlug({ slug });

    // Get the token to verify it belongs to this agent
    const token = await this.issuedAccessTokenService.getTokenById(tokenId);
    if (!token) {
      throw new NotFoundException('Token not found');
    }

    // Verify the token belongs to this agent
    if (token.subjectActorId !== agent.actorId) {
      throw new ForbiddenException('Token does not belong to this agent');
    }

    // Revoke the token
    const revokedToken =
      await this.issuedAccessTokenService.revokeTokenById(tokenId);
    if (!revokedToken) {
      throw new NotFoundException('Token not found');
    }

    return {
      id: revokedToken.id,
      name: revokedToken.name,
      scopes: revokedToken.scopes,
      sub: revokedToken.subjectActorId,
      subjectSlug: revokedToken.subjectActor?.slug ?? 'unknown',
      subjectDisplayName: revokedToken.subjectActor?.displayName ?? 'Unknown',
      issuedBy: revokedToken.issuedByActorId,
      issuedByDisplayName: revokedToken.issuedByActor?.displayName ?? 'Unknown',
      expiresAt: revokedToken.expiresAt.toISOString(),
      createdAt: revokedToken.createdAt.toISOString(),
      revokedAt: revokedToken.revokedAt?.toISOString() ?? null,
      lastUsedAt: revokedToken.lastUsedAt?.toISOString() ?? null,
      isValid: revokedToken.isValid,
    };
  }
}
