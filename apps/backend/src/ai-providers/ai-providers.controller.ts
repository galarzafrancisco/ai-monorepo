import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
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
import { AiProvidersService } from './ai-providers.service';
import { CreateAiProviderDto } from './dto/http/create-ai-provider.dto';
import { UpdateAiProviderDto } from './dto/http/update-ai-provider.dto';
import { AiProviderResponseDto } from './dto/http/ai-provider-response.dto';
import { AiProviderParamsDto } from './dto/http/ai-provider-params.dto';
import { AiProviderModelResponseDto } from './dto/http/ai-provider-model-response.dto';
import { AiProviderModelsService } from './ai-provider-models.service';
import { AiProviderResult } from './dto/service/ai-providers.service.types';
import { AiProvidersScopes } from './ai-providers.scopes';

@ApiTags('AI Providers')
@ApiCookieAuth('JWT-Cookie')
@Controller('ai-providers')
@UseGuards(AccessTokenGuard, ScopesGuard)
export class AiProvidersController {
  constructor(
    private readonly aiProvidersService: AiProvidersService,
    private readonly aiProviderModelsService: AiProviderModelsService,
  ) {}

  @Post()
  @RequireScopes(AiProvidersScopes.WRITE.id)
  @ApiOperation({ summary: 'Create an AI provider' })
  @ApiCreatedResponse({
    type: AiProviderResponseDto,
    description: 'AI provider created successfully',
  })
  async createAiProvider(@Body() dto: CreateAiProviderDto): Promise<AiProviderResponseDto> {
    const result = await this.aiProvidersService.createAiProvider({
      name: dto.name,
      type: dto.type,
      secretId: dto.secretId,
      baseUrl: dto.baseUrl,
      project: dto.project,
      location: dto.location,
    });
    return this.mapToResponse(result);
  }

  @Get()
  @RequireScopes(AiProvidersScopes.READ.id)
  @ApiOperation({ summary: 'List all AI providers' })
  @ApiOkResponse({ type: [AiProviderResponseDto], description: 'List of AI providers' })
  async listAiProviders(): Promise<AiProviderResponseDto[]> {
    const results = await this.aiProvidersService.listAiProviders();
    return results.map((r) => this.mapToResponse(r));
  }

  @Get(':id')
  @RequireScopes(AiProvidersScopes.READ.id)
  @ApiOperation({ summary: 'Get AI provider by ID' })
  @ApiOkResponse({ type: AiProviderResponseDto, description: 'AI provider details' })
  @ApiNotFoundResponse({ description: 'AI provider not found' })
  async getAiProvider(@Param() params: AiProviderParamsDto): Promise<AiProviderResponseDto> {
    const result = await this.aiProvidersService.getAiProviderById(params.id);
    return this.mapToResponse(result);
  }

  @Patch(':id')
  @RequireScopes(AiProvidersScopes.WRITE.id)
  @ApiOperation({ summary: 'Update an AI provider' })
  @ApiOkResponse({
    type: AiProviderResponseDto,
    description: 'AI provider updated successfully',
  })
  @ApiNotFoundResponse({ description: 'AI provider not found' })
  async updateAiProvider(
    @Param() params: AiProviderParamsDto,
    @Body() dto: UpdateAiProviderDto,
    @CurrentUser() user: UserContext,
  ): Promise<AiProviderResponseDto> {
    const result = await this.aiProvidersService.updateAiProvider(params.id, {
      name: dto.name,
      secretId: dto.secretId,
      apiKey: dto.apiKey,
      createdByActorId: user.actorId,
      baseUrl: dto.baseUrl,
      project: dto.project,
      location: dto.location,
    });
    return this.mapToResponse(result);
  }

  @Delete(':id')
  @HttpCode(204)
  @RequireScopes(AiProvidersScopes.DELETE.id)
  @ApiOperation({ summary: 'Delete an AI provider' })
  @ApiNoContentResponse({ description: 'AI provider deleted successfully' })
  @ApiNotFoundResponse({ description: 'AI provider not found' })
  async deleteAiProvider(@Param() params: AiProviderParamsDto): Promise<void> {
    await this.aiProvidersService.deleteAiProvider(params.id);
  }

  @Get(':id/models')
  @RequireScopes(AiProvidersScopes.READ.id)
  @ApiOperation({ summary: 'List the models the provider offers, fetched live from the provider' })
  @ApiOkResponse({ type: [AiProviderModelResponseDto], description: 'Models offered by the provider' })
  @ApiNotFoundResponse({ description: 'AI provider not found' })
  async listAiProviderModels(
    @Param() params: AiProviderParamsDto,
    @CurrentUser() user: UserContext,
  ): Promise<AiProviderModelResponseDto[]> {
    const models = await this.aiProviderModelsService.listModels(params.id, user.actorId);
    return models.map((model) => ({
      id: model.id,
      displayName: model.displayName,
      kind: model.kind,
    }));
  }

  private mapToResponse(result: AiProviderResult): AiProviderResponseDto {
    return {
      id: result.id,
      name: result.name,
      type: result.type,
      secretId: result.secretId,
      baseUrl: result.baseUrl,
      project: result.project,
      location: result.location,
      isConfigured: result.isConfigured,
      rowVersion: result.rowVersion,
      createdAt: result.createdAt.toISOString(),
      updatedAt: result.updatedAt.toISOString(),
    };
  }
}
