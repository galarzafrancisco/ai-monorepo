import { Body, Controller, Param, Post, UseGuards } from '@nestjs/common';
import {
  ApiCookieAuth,
  ApiCreatedResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { AccessTokenGuard } from '../auth/guards/guards/access-token.guard';
import { ScopesGuard } from '../auth/guards/guards/scopes.guard';
import { RequireScopes } from '../auth/guards/decorators/require-scopes.decorator';
import { CurrentAuth } from '../auth/guards/decorators/current-auth.decorator';
import type { AuthContext } from '../auth/guards/context/auth-context.types';
import { AgentsScopes } from './agents.scopes';
import { AgentsService } from './agents.service';
import { ActorService } from '../identity-provider/actor.service';
import { IssuedAccessTokenService } from '../authorization-server/issued-access-token.service';
import { AgentExecutionTokenResponseDto } from './dto/agent-execution-token-response.dto';
import { RequestAgentExecutionTokenDto } from './dto/request-agent-execution-token.dto';
import { AgentToolPermissionsService } from './agent-tool-permissions.service';
import { deriveExecutionScopesFromToolPermissions } from '@taico/shared';
import { AgentToolPermissionRecord } from './dto/service/agent-tool-permissions.service.types';

@ApiTags('Agent Execution Tokens')
@ApiCookieAuth('JWT-Cookie')
@Controller('agents/:slug/execution-token')
@UseGuards(AccessTokenGuard, ScopesGuard)
@RequireScopes(AgentsScopes.ACT_AS.id)
export class AgentExecutionTokensController {
  constructor(
    private readonly agentsService: AgentsService,
    private readonly actorService: ActorService,
    private readonly issuedAccessTokenService: IssuedAccessTokenService,
    private readonly agentToolPermissionsService: AgentToolPermissionsService,
  ) {}

  @Post()
  @ApiOperation({
    summary: 'Request a short-lived execution token for an agent',
  })
  @ApiParam({ name: 'slug', description: 'Agent slug' })
  @ApiCreatedResponse({ type: AgentExecutionTokenResponseDto })
  async requestExecutionToken(
    @Param('slug') slug: string,
    @Body() dto: RequestAgentExecutionTokenDto,
    @CurrentAuth() auth: AuthContext,
  ): Promise<AgentExecutionTokenResponseDto> {
    const agent = await this.agentsService.getAgentBySlug({ slug });
    const subjectActor = await this.actorService.getActorById(agent.actorId);
    const issuedByActor = await this.actorService.getActorById(
      auth.claims.actor_id,
    );

    if (!subjectActor) {
      throw new Error(`Agent actor not found for slug: ${slug}`);
    }
    if (!issuedByActor) {
      throw new Error(
        `Issuing actor not found for auth subject: ${auth.claims.actor_id}`,
      );
    }

    const scopes =
      dto.scopes && dto.scopes.length > 0
        ? dto.scopes
        : deriveExecutionScopesFromToolPermissions(
            (
              await this.agentToolPermissionsService.listAgentToolPermissions(
                agent.actorId,
              )
            ).map((permission) => this.toRuntimePermission(permission)),
          );

    const issuedToken = await this.issuedAccessTokenService.issueSystemToken({
      subjectActor,
      issuedByActor,
      scopes,
      expirationSeconds: dto.expirationSeconds,
    });

    return {
      token: issuedToken.token,
      scopes,
      expiresAt: issuedToken.expiresAt.toISOString(),
      agentSlug: subjectActor.slug,
      requestedByClientId: auth.claims.client_id,
    };
  }

  private toRuntimePermission(permission: AgentToolPermissionRecord): {
    server: { providedId: string };
    grantedScopes: { id: string }[];
  } {
    return {
      server: {
        providedId: permission.serverProvidedId,
      },
      grantedScopes: permission.grantedScopes.map((scope) => ({
        id: scope.id,
      })),
    };
  }
}
