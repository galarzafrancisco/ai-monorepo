import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TagEntity } from './tag.entity';
import { ProjectEntity } from './project.entity';
import { MetaService } from './meta.service';
import { ProjectsService } from './projects.service';
import { MetaController } from './meta.controller';
import { ProjectsController } from './projects.controller';
import { AuthorizationServerModule } from '../authorization-server/authorization-server.module';
import { AuthGuardsModule } from '../auth/guards/auth-guards.module';
import { SearchModule } from '../search/search.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([TagEntity, ProjectEntity]),
    AuthorizationServerModule,
    AuthGuardsModule,
    SearchModule,
  ],
  controllers: [MetaController, ProjectsController],
  providers: [MetaService, ProjectsService],
  exports: [MetaService, ProjectsService],
})
export class MetaModule {}
