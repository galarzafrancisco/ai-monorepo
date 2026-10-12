import { Module } from '@nestjs/common';
import { AiProvidersModule } from '../ai-providers/ai-providers.module';
import { SearchService } from './search.service';
import { IndexSearchService } from './index/index-search.service';
import { SearchEmbedderService } from './index/search-embedder.service';
import { SearchEmbeddingsService } from './index/search-embeddings.service';
import { SearchIndexAdminService } from './index/search-index-admin.service';
import { SearchIndexerService } from './index/search-indexer.service';
import { SearchSettingsService } from './index/search-settings.service';
import { SearchVectorStoreService } from './index/search-vector-store.service';

@Module({
  imports: [AiProvidersModule],
  providers: [
    SearchService,
    SearchSettingsService,
    SearchVectorStoreService,
    SearchEmbeddingsService,
    SearchEmbedderService,
    SearchIndexerService,
    IndexSearchService,
    SearchIndexAdminService,
  ],
  exports: [SearchService, IndexSearchService, SearchSettingsService, SearchIndexAdminService],
})
export class SearchModule {}
