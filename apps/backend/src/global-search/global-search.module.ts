import { Module } from '@nestjs/common';
import { GlobalSearchService } from './global-search.service';
import { GlobalSearchController } from './global-search.controller';
import { TasksModule } from '../tasks/tasks.module';
import { ContextModule } from '../context/context.module';
import { AuthGuardsModule } from '../auth/guards/auth-guards.module';

@Module({
  imports: [TasksModule, ContextModule, AuthGuardsModule],
  controllers: [GlobalSearchController],
  providers: [GlobalSearchService],
  exports: [GlobalSearchService],
})
export class GlobalSearchModule {}
