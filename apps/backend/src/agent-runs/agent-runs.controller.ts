import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiOkResponse,
  ApiCreatedResponse,
  ApiBadRequestResponse,
  ApiNotFoundResponse,
  ApiCookieAuth,
} from '@nestjs/swagger';
import { AgentRunsService } from './agent-runs.service';
import { CreateAgentRunDto } from './dto/create-agent-run.dto';
import { UpdateAgentRunDto } from './dto/update-agent-run.dto';
import { AgentRunResponseDto } from './dto/agent-run-response.dto';
import { AgentRunListResponseDto } from './dto/agent-run-list-response.dto';
import { AgentRunParamsDto } from './dto/agent-run-params.dto';
import { ListAgentRunsQueryDto } from './dto/list-agent-runs-query.dto';
import {
  AgentRunResult,
  ActorResult,
  TaskResult,
} from './dto/service/agent-runs.service.types';
import { ActorResponseDto } from '../identity-provider/dto/actor-response.dto';
import { AccessTokenGuard } from '../auth/guards/guards/access-token.guard';
import { ScopesGuard } from 'src/auth/guards/guards/scopes.guard';
import { RequireScopes } from 'src/auth/guards/decorators/require-scopes.decorator';
import { AgentRunsScopes } from './agent-runs.scopes';
import { CurrentUser } from 'src/auth/guards/decorators/current-user.decorator';
import type { UserContext } from 'src/auth/guards/context/auth-context.types';

@ApiTags('AgentRun')
@ApiCookieAuth('JWT-Cookie')
@Controller('agent-runs')
@UseGuards(AccessTokenGuard, ScopesGuard)
@RequireScopes(AgentRunsScopes.READ.id)
export class AgentRunsController {
  constructor(private readonly agentRunsService: AgentRunsService) {}

  @Post()
  @RequireScopes(AgentRunsScopes.WRITE.id)
  @ApiOperation({ summary: 'Create a new agent run' })
  @ApiCreatedResponse({
    type: AgentRunResponseDto,
    description: 'Agent run created successfully',
  })
  @ApiBadRequestResponse({ description: 'Invalid input data' })
  async createAgentRun(
    @Body() dto: CreateAgentRunDto,
    @CurrentUser() user: UserContext,
  ): Promise<AgentRunResponseDto> {
    const result = await this.agentRunsService.createAgentRun({
      actorId: user.actorId,
      parentTaskId: dto.parentTaskId,
    });
    return this.mapResultToResponse(result);
  }

  @Get()
  @ApiOperation({ summary: 'List agent runs with optional filters' })
  @ApiOkResponse({
    type: AgentRunListResponseDto,
    description: 'List of agent runs retrieved successfully',
  })
  async listAgentRuns(
    @Query() query: ListAgentRunsQueryDto,
  ): Promise<AgentRunListResponseDto> {
    const result = await this.agentRunsService.listAgentRuns({
      actorId: query.actorId,
      parentTaskId: query.parentTaskId,
      page: query.page ?? 1,
      limit: query.limit ?? 20,
    });

    return {
      items: result.items.map((item) => this.mapResultToResponse(item)),
      total: result.total,
      page: result.page,
      limit: result.limit,
    };
  }

  @Get(':runId')
  @ApiOperation({ summary: 'Get an agent run by ID' })
  @ApiOkResponse({
    type: AgentRunResponseDto,
    description: 'Agent run retrieved successfully',
  })
  @ApiNotFoundResponse({ description: 'Agent run not found' })
  async getAgentRunById(
    @Param() params: AgentRunParamsDto,
  ): Promise<AgentRunResponseDto> {
    const result = await this.agentRunsService.getAgentRunById(params.runId);
    return this.mapResultToResponse(result);
  }

  @Patch(':runId')
  @RequireScopes(AgentRunsScopes.WRITE.id)
  @ApiOperation({ summary: 'Update an agent run' })
  @ApiOkResponse({
    type: AgentRunResponseDto,
    description: 'Agent run updated successfully',
  })
  @ApiNotFoundResponse({ description: 'Agent run not found' })
  @ApiBadRequestResponse({ description: 'Invalid input data' })
  async updateAgentRun(
    @Param() params: AgentRunParamsDto,
    @Body() dto: UpdateAgentRunDto,
  ): Promise<AgentRunResponseDto> {
    const result = await this.agentRunsService.updateAgentRun(params.runId, {
      startedAt: dto.startedAt ? new Date(dto.startedAt) : undefined,
      endedAt: dto.endedAt ? new Date(dto.endedAt) : undefined,
      lastPing: dto.lastPing ? new Date(dto.lastPing) : undefined,
    });
    return this.mapResultToResponse(result);
  }

  private mapResultToResponse(result: AgentRunResult): AgentRunResponseDto {
    return {
      id: result.id,
      actorId: result.actorId,
      actor: result.actor ? this.mapActorToResponse(result.actor) : null,
      parentTaskId: result.parentTaskId,
      parentTask: result.parentTask
        ? {
            id: result.parentTask.id,
            name: result.parentTask.name,
          }
        : null,
      createdAt: result.createdAt.toISOString(),
      startedAt: result.startedAt ? result.startedAt.toISOString() : null,
      endedAt: result.endedAt ? result.endedAt.toISOString() : null,
      lastPing: result.lastPing ? result.lastPing.toISOString() : null,
    };
  }

  private mapActorToResponse(actor: ActorResult): ActorResponseDto {
    return {
      id: actor.id,
      type: actor.type,
      slug: actor.slug,
      displayName: actor.displayName,
      avatarUrl: actor.avatarUrl,
    };
  }
}
