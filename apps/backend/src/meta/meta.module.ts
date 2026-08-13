import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TagEntity } from './tag.entity';
import { TagUsageEntity } from './tag-usage.entity';
import { ProjectEntity } from './project.entity';
import { MetaService } from './meta.service';
import { ProjectsService } from './projects.service';
import { MetaController } from './meta.controller';
import { ProjectsController } from './projects.controller';
import { TransactionalTagWriterService } from './transactional-tag-writer.service';
import { AuthorizationServerModule } from '../authorization-server/authorization-server.module';
import { AuthGuardsModule } from '../auth/guards/auth-guards.module';
import { SearchModule } from '../search/search.module';
import { DeleteProjectUseCase } from './use-cases/delete-project.use-case';
import { CreateProjectUseCase } from './use-cases/create-project.use-case';

@Module({
  imports: [
    TypeOrmModule.forFeature([TagEntity, TagUsageEntity, ProjectEntity]),
    AuthorizationServerModule,
    AuthGuardsModule,
    SearchModule,
  ],
  controllers: [MetaController, ProjectsController],
  providers: [
    MetaService,
    ProjectsService,
    TransactionalTagWriterService,
    DeleteProjectUseCase,
    CreateProjectUseCase,
  ],
  exports: [MetaService, ProjectsService, TransactionalTagWriterService],
})
export class MetaModule {}
