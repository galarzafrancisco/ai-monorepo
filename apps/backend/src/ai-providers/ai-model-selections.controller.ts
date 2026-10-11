import { Body, Controller, Delete, Get, HttpCode, Param, Put, UseGuards } from '@nestjs/common';
import {
  ApiCookieAuth,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { AccessTokenGuard } from '../auth/guards/guards/access-token.guard';
import { ScopesGuard } from '../auth/guards/guards/scopes.guard';
import { RequireScopes } from '../auth/guards/decorators/require-scopes.decorator';
import { AiModelSelectionsService } from './ai-model-selections.service';
import { AiProvidersScopes } from './ai-providers.scopes';
import { AiModelSelectionParamsDto } from './dto/http/ai-model-selection-params.dto';
import { AiModelSelectionResponseDto } from './dto/http/ai-model-selection-response.dto';
import { SetAiModelSelectionDto } from './dto/http/set-ai-model-selection.dto';
import { AiModelSelectionResult } from './dto/service/ai-providers.service.types';

@ApiTags('AI Model Selections')
@ApiCookieAuth('JWT-Cookie')
@Controller('ai-model-selections')
@UseGuards(AccessTokenGuard, ScopesGuard)
export class AiModelSelectionsController {
  constructor(private readonly aiModelSelectionsService: AiModelSelectionsService) {}

  @Get()
  @RequireScopes(AiProvidersScopes.READ.id)
  @ApiOperation({ summary: 'List which model each job uses' })
  @ApiOkResponse({
    type: [AiModelSelectionResponseDto],
    description: 'One entry per job, selected or not',
  })
  async listAiModelSelections(): Promise<AiModelSelectionResponseDto[]> {
    const results = await this.aiModelSelectionsService.listSelections();
    return results.map((result) => this.mapToResponse(result));
  }

  @Put(':job')
  @RequireScopes(AiProvidersScopes.CONFIGURE.id)
  @ApiOperation({ summary: 'Select the provider and model a job uses' })
  @ApiOkResponse({ type: AiModelSelectionResponseDto, description: 'Selection saved' })
  @ApiNotFoundResponse({ description: 'AI provider not found' })
  async setAiModelSelection(
    @Param() params: AiModelSelectionParamsDto,
    @Body() dto: SetAiModelSelectionDto,
  ): Promise<AiModelSelectionResponseDto> {
    const result = await this.aiModelSelectionsService.setSelection({
      job: params.job,
      aiProviderId: dto.aiProviderId,
      modelId: dto.modelId,
    });
    return this.mapToResponse(result);
  }

  @Delete(':job')
  @HttpCode(204)
  @RequireScopes(AiProvidersScopes.CONFIGURE.id)
  @ApiOperation({ summary: "Clear a job's selection" })
  @ApiNoContentResponse({ description: 'Selection cleared' })
  async clearAiModelSelection(@Param() params: AiModelSelectionParamsDto): Promise<void> {
    await this.aiModelSelectionsService.clearSelection(params.job);
  }

  private mapToResponse(result: AiModelSelectionResult): AiModelSelectionResponseDto {
    return {
      job: result.job,
      aiProviderId: result.aiProviderId,
      modelId: result.modelId,
      followsConversation: result.followsConversation,
      effectiveAiProviderId: result.effectiveAiProviderId,
      effectiveModelId: result.effectiveModelId,
      isReady: result.isReady,
    };
  }
}
