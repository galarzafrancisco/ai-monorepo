import { Module } from '@nestjs/common';
import { GlobalSearchService } from './global-search.service';
import { GlobalSearchController } from './global-search.controller';
import { SearchAdminController } from './search-admin.controller';
import { AuthGuardsModule } from '../auth/guards/auth-guards.module';
import { SearchModule } from '../search/search.module';

@Module({
  imports: [SearchModule, AuthGuardsModule],
  controllers: [GlobalSearchController, SearchAdminController],
  providers: [GlobalSearchService],
  exports: [GlobalSearchService],
})
export class GlobalSearchModule {}
