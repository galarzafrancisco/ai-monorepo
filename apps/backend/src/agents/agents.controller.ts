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
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiOkResponse,
  ApiCreatedResponse,
} from '@nestjs/swagger';
import { AgentsService } from './agents.service';
import { CreateAgentDto } from './dto/create-agent.dto';
import { UpdateAgentDto } from './dto/update-agent.dto';
import { AgentResponseDto } from './dto/agent-response.dto';
import { AgentListResponseDto } from './dto/agent-list-response.dto';
import { ListAgentsQueryDto } from './dto/list-agents-query.dto';
import { AgentParamsDto } from './dto/agent-params.dto';
import { AgentResult } from './dto/service/agents.service.types';

@ApiTags('Agent')
@Controller('agents')
export class AgentsController {
  constructor(private readonly agentsService: AgentsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new agent' })
  @ApiCreatedResponse({ type: AgentResponseDto })
  async createAgent(@Body() dto: CreateAgentDto): Promise<AgentResponseDto> {
    const result = await this.agentsService.createAgent({
      slug: dto.slug,
      name: dto.name,
      description: dto.description,
      systemPrompt: dto.systemPrompt,
      allowedTools: dto.allowedTools,
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

  @Get(':id')
  @ApiOperation({ summary: 'Get an agent by ID or slug' })
  @ApiOkResponse({ type: AgentResponseDto })
  async getAgent(@Param() params: AgentParamsDto): Promise<AgentResponseDto> {
    const result = await this.agentsService.getAgentByIdOrSlug(params.id);
    return this.mapResultToResponse(result);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update an agent' })
  @ApiOkResponse({ type: AgentResponseDto })
  async updateAgent(
    @Param() params: AgentParamsDto,
    @Body() dto: UpdateAgentDto,
  ): Promise<AgentResponseDto> {
    const result = await this.agentsService.updateAgent(params.id, {
      slug: dto.slug,
      name: dto.name,
      description: dto.description,
      systemPrompt: dto.systemPrompt,
      allowedTools: dto.allowedTools,
      isActive: dto.isActive,
      concurrencyLimit: dto.concurrencyLimit,
    });
    return this.mapResultToResponse(result);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete an agent' })
  async deleteAgent(@Param() params: AgentParamsDto): Promise<void> {
    await this.agentsService.deleteAgent(params.id);
  }

  private mapResultToResponse(result: AgentResult): AgentResponseDto {
    return {
      id: result.id,
      slug: result.slug,
      name: result.name,
      description: result.description,
      systemPrompt: result.systemPrompt,
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
