import { Module } from '@nestjs/common';
import { GlobalSearchService } from './global-search.service';
import { GlobalSearchController } from './global-search.controller';
import { TasksModule } from '../tasks/tasks.module';
import { ContextModule } from '../context/context.module';
import { AuthGuardsModule } from '../auth/guards/auth-guards.module';
import { IdentityProviderModule } from '../identity-provider/identity-provider.module';
import { MetaModule } from '../meta/meta.module';

@Module({
  imports: [
    TasksModule,
    ContextModule,
    IdentityProviderModule,
    MetaModule,
    AuthGuardsModule,
  ],
  controllers: [GlobalSearchController],
  providers: [GlobalSearchService],
  exports: [GlobalSearchService],
})
export class GlobalSearchModule {}
