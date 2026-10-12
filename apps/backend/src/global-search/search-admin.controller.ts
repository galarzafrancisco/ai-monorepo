import { Body, Controller, Delete, Get, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiCookieAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AccessTokenGuard } from '../auth/guards/guards/access-token.guard';
import { ScopesGuard } from '../auth/guards/guards/scopes.guard';
import { RequireScopes } from '../auth/guards/decorators/require-scopes.decorator';
import { SearchIndexAdminService, SearchIndexStatus } from '../search/index/search-index-admin.service';
import { SearchSettings } from '../search/index/search-settings';
import { SearchSettingsService } from '../search/index/search-settings.service';
import { SearchScopes } from '../search/search.scopes';
import { SearchIndexStatusDto } from './dto/search-index-status.dto';
import { SearchSettingsDto } from './dto/search-settings.dto';
import { UpdateSearchSettingsDto } from './dto/update-search-settings.dto';

@ApiTags('Search')
@ApiCookieAuth('JWT-Cookie')
@Controller('search')
@UseGuards(AccessTokenGuard, ScopesGuard)
export class SearchAdminController {
  constructor(
    private readonly searchSettingsService: SearchSettingsService,
    private readonly searchIndexAdminService: SearchIndexAdminService,
  ) {}

  @Get('settings')
  @ApiOperation({ summary: 'Get the search settings' })
  @ApiOkResponse({ type: SearchSettingsDto, description: 'Every setting with its current value' })
  async getSearchSettings(): Promise<SearchSettingsDto> {
    return this.mapSettings(await this.searchSettingsService.get());
  }

  @Patch('settings')
  @RequireScopes(SearchScopes.CONFIGURE.id)
  @ApiOperation({
    summary: 'Change search settings',
    description: 'Changes the settings sent and leaves the others as they are.',
  })
  @ApiOkResponse({ type: SearchSettingsDto, description: 'The settings after the change' })
  async updateSearchSettings(@Body() dto: UpdateSearchSettingsDto): Promise<SearchSettingsDto> {
    return this.mapSettings(await this.searchSettingsService.update({ ...dto }));
  }

  @Delete('settings')
  @RequireScopes(SearchScopes.CONFIGURE.id)
  @ApiOperation({ summary: 'Reset the search settings to their defaults' })
  @ApiOkResponse({ type: SearchSettingsDto, description: 'The default settings' })
  async resetSearchSettings(): Promise<SearchSettingsDto> {
    return this.mapSettings(await this.searchSettingsService.reset());
  }

  @Get('index')
  @ApiOperation({ summary: 'Get the state of the search index' })
  @ApiOkResponse({ type: SearchIndexStatusDto, description: 'What is indexed and embedded' })
  async getSearchIndexStatus(): Promise<SearchIndexStatusDto> {
    return this.mapStatus(await this.searchIndexAdminService.getStatus());
  }

  @Post('index/rebuild')
  @RequireScopes(SearchScopes.CONFIGURE.id)
  @ApiOperation({
    summary: 'Rebuild the search index',
    description:
      'Discards the index and builds it again. Keyword search is complete when this returns; embeddings are rebuilt in the background.',
  })
  @ApiOkResponse({ type: SearchIndexStatusDto, description: 'The index right after the rebuild started' })
  async rebuildSearchIndex(): Promise<SearchIndexStatusDto> {
    return this.mapStatus(await this.searchIndexAdminService.rebuild());
  }

  private mapSettings(settings: SearchSettings): SearchSettingsDto {
    return {
      semanticEnabled: settings.semanticEnabled,
      chunkSizeChars: settings.chunkSizeChars,
      chunkOverlapChars: settings.chunkOverlapChars,
      queryInstruction: settings.queryInstruction,
      queryEmbeddingTimeoutMs: settings.queryEmbeddingTimeoutMs,
      candidatesPerStrategy: settings.candidatesPerStrategy,
      semanticMinSimilarity: settings.semanticMinSimilarity,
      semanticMaxGap: settings.semanticMaxGap,
      keywordMinDensity: settings.keywordMinDensity,
      fuzzyMinSimilarity: settings.fuzzyMinSimilarity,
      rrfK: settings.rrfK,
      keywordWeight: settings.keywordWeight,
      fuzzyTitleWeight: settings.fuzzyTitleWeight,
      semanticWeight: settings.semanticWeight,
      exactTitleBoost: settings.exactTitleBoost,
      doneTaskMultiplier: settings.doneTaskMultiplier,
      excerptMaxChars: settings.excerptMaxChars,
      defaultLimit: settings.defaultLimit,
    };
  }

  private mapStatus(status: SearchIndexStatus): SearchIndexStatusDto {
    return {
      semanticActive: status.semanticActive,
      semanticInactiveReason: status.semanticInactiveReason,
      embeddingModelId: status.embeddingModelId,
      documents: status.documents,
      embedded: status.embedded,
      pending: status.pending,
      failed: status.failed,
      lastError: status.lastError,
      byType: status.byType.map((entry) => ({
        type: entry.type,
        documents: entry.documents,
        embedded: entry.embedded,
      })),
    };
  }
}
