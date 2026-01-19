import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TaskEntity } from './task.entity';
import { CommentEntity } from './comment.entity';
import { TagEntity } from './tag.entity';
import { TasksService } from './tasks.service';
import { TasksController } from './tasks.controller';
import { TasksGateway } from './tasks.gateway';
import { TasksMcpGateway } from './tasks.mcp.gateway';
import { AuthorizationServerModule } from '../authorization-server/authorization-server.module';
import { AuthGuardsModule } from '../auth/guards/auth-guards.module';
import { IdentityProviderModule } from '../identity-provider/identity-provider.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([TaskEntity, CommentEntity, TagEntity]),
    AuthorizationServerModule,
    AuthGuardsModule,
    IdentityProviderModule,
  ],
  controllers: [TasksController],
  providers: [TasksService, TasksGateway, TasksMcpGateway],
  exports: [TasksService],
})
export class TasksModule {}
