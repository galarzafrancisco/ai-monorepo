import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TaskEntity } from './task.entity';
import { CommentEntity } from './comment.entity';
import { TagEntity } from './tag.entity';
import { TaskerooService } from './taskeroo.service';
import { TaskerooController } from './taskeroo.controller';
import { TaskerooGateway } from './taskeroo.gateway';
import { TaskerooMcpGateway } from './taskeroo.mcp.gateway';
import { AuthorizationServerModule } from '../authorization-server/authorization-server.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([TaskEntity, CommentEntity, TagEntity]),
    AuthorizationServerModule,
  ],
  controllers: [TaskerooController],
  providers: [TaskerooService, TaskerooGateway, TaskerooMcpGateway],
  exports: [TaskerooService],
})
export class TaskerooModule {}
