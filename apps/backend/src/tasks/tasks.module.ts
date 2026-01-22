import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TaskEntity } from './task.entity';
import { CommentEntity } from './comment.entity';
import { InputRequestEntity } from './input-request.entity';
import { AssigneeHistoryEntity } from './assignee-history.entity';
import { TasksService } from './tasks.service';
import { TasksController } from './tasks.controller';
import { TasksGateway } from './tasks.gateway';
import { TasksMcpGateway } from './tasks.mcp.gateway';
import { AuthorizationServerModule } from '../authorization-server/authorization-server.module';
import { AuthGuardsModule } from '../auth/guards/auth-guards.module';
import { IdentityProviderModule } from '../identity-provider/identity-provider.module';
import { MetaModule } from '../meta/meta.module';
import { SearchModule } from '../search/search.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([TaskEntity, CommentEntity, InputRequestEntity, AssigneeHistoryEntity]),
    AuthorizationServerModule,
    AuthGuardsModule,
    IdentityProviderModule,
    MetaModule,
    SearchModule,
  ],
  controllers: [TasksController],
  providers: [TasksService, TasksGateway, TasksMcpGateway],
  exports: [TasksService],
})
export class TasksModule {}
