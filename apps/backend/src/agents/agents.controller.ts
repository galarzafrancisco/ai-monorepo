import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiOkResponse,
  ApiCreatedResponse,
  ApiCookieAuth,
} from '@nestjs/swagger';
import { AgentsService } from './agents.service';
import { CreateAgentDto } from './dto/create-agent.dto';
import { UpdateAgentDto } from './dto/update-agent.dto';
import { PatchAgentDto } from './dto/patch-agent.dto';
import { AgentResponseDto } from './dto/agent-response.dto';
import { AgentListResponseDto } from './dto/agent-list-response.dto';
import { ListAgentsQueryDto } from './dto/list-agents-query.dto';
import { AgentParamsDto } from './dto/agent-params.dto';
import { AgentActorParamsDto } from './dto/agent-actor-params.dto';
import { AgentResult } from './dto/service/agents.service.types';
import { AccessTokenGuard } from '../auth/guards/guards/access-token.guard';
import { RequireScopes } from 'src/auth/guards/decorators/require-scopes.decorator';
import { AgentsScopes } from './agents.scopes';
import { ScopesGuard } from 'src/auth/guards/guards/scopes.guard';

@ApiTags('Agent')
@ApiCookieAuth('JWT-Cookie')
@Controller('agents')
@UseGuards(AccessTokenGuard, ScopesGuard)
@RequireScopes(AgentsScopes.READ.id)
export class AgentsController {
  constructor(private readonly agentsService: AgentsService) {}

  @Post()
  @RequireScopes(AgentsScopes.WRITE.id)
  @ApiOperation({ summary: 'Create a new agent' })
  @ApiCreatedResponse({ type: AgentResponseDto })
  async createAgent(@Body() dto: CreateAgentDto): Promise<AgentResponseDto> {
    const result = await this.agentsService.createAgent({
      slug: dto.slug,
      name: dto.name,
      type: dto.type,
      description: dto.description,
      systemPrompt: dto.systemPrompt,
      statusTriggers: dto.statusTriggers || [],
      allowedTools: dto.allowedTools || [],
      isActive: dto.isActive,
      concurrencyLimit: dto.concurrencyLimit,
    });
    return this.mapResultToResponse(result);
  }

  @Get()
  @ApiOperation({
    summary: 'List agents with optional filtering and pagination',
  })
  @ApiOkResponse({ type: AgentListResponseDto })
  async listAgents(
    @Query() query: ListAgentsQueryDto,
  ): Promise<AgentListResponseDto> {
    const result = await this.agentsService.listAgents({
      isActive: query.isActive,
      page: query.page ?? 1,
      limit: query.limit ?? 20,
    });

    return {
      items: result.items.map((item) => this.mapResultToResponse(item)),
      total: result.total,
      page: result.page,
      limit: result.limit,
      totalPages: Math.ceil(result.total / result.limit),
    };
  }

  @Get(':slug')
  @ApiOperation({ summary: 'Get an agent by slug' })
  @ApiOkResponse({ type: AgentResponseDto })
  async getAgentBySlug(
    @Param() params: AgentParamsDto,
  ): Promise<AgentResponseDto> {
    console.log(params);
    const result = await this.agentsService.getAgentBySlug({
      slug: params.slug,
    });
    return this.mapResultToResponse(result);
  }

  @Patch(':actorId')
  @RequireScopes(AgentsScopes.WRITE.id)
  @ApiOperation({
    summary:
      'Patch an agent (update system prompt, status triggers, and/or type)',
  })
  @ApiOkResponse({ type: AgentResponseDto })
  async patchAgent(
    @Param() params: AgentActorParamsDto,
    @Body() dto: PatchAgentDto,
  ): Promise<AgentResponseDto> {
    const result = await this.agentsService.patchAgent(params.actorId, {
      systemPrompt: dto.systemPrompt,
      statusTriggers: dto.statusTriggers,
      type: dto.type,
    });
    return this.mapResultToResponse(result);
  }

  // @Patch(':id')
  // @RequireScopes(AgentsScopes.WRITE.id)
  // @UseGuards(AccessTokenGuard)
  // @ApiOperation({ summary: 'Update an agent' })
  // @ApiOkResponse({ type: AgentResponseDto })
  // async updateAgent(
  //   @Param() params: AgentParamsDto,
  //   @Body() dto: UpdateAgentDto,
  // ): Promise<AgentResponseDto> {
  //   const result = await this.agentsService.updateAgent(params.id, {
  //     slug: dto.slug,
  //     name: dto.name,
  //     type: dto.type,
  //     description: dto.description,
  //     systemPrompt: dto.systemPrompt,
  //     allowedTools: dto.allowedTools,
  //     isActive: dto.isActive,
  //     concurrencyLimit: dto.concurrencyLimit,
  //   });
  //   return this.mapResultToResponse(result);
  // }

  @Delete(':actorId')
  @RequireScopes(AgentsScopes.WRITE.id)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete an agent' })
  async deleteAgent(@Param() params: AgentActorParamsDto): Promise<void> {
    await this.agentsService.deleteAgent(params.actorId);
  }

  private mapResultToResponse(result: AgentResult): AgentResponseDto {
    return {
      actorId: result.actorId,
      slug: result.slug,
      name: result.name,
      type: result.type,
      description: result.description,
      systemPrompt: result.systemPrompt,
      statusTriggers: result.statusTriggers,
      allowedTools: result.allowedTools,
      isActive: result.isActive,
      concurrencyLimit: result.concurrencyLimit,
      rowVersion: result.rowVersion,
      createdAt: result.createdAt.toISOString(),
      updatedAt: result.updatedAt.toISOString(),
      deletedAt: result.deletedAt ? result.deletedAt.toISOString() : null,
    };
  }
}
