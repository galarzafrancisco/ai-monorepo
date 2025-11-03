import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TaskEntity } from './task.entity';
import { CommentEntity } from './comment.entity';
import { TaskerooService } from './taskeroo.service';
import { TaskerooController } from './taskeroo.controller';
import { TaskerooGateway } from './taskeroo.gateway';

@Module({
  imports: [TypeOrmModule.forFeature([TaskEntity, CommentEntity])],
  controllers: [TaskerooController],
  providers: [TaskerooService, TaskerooGateway],
  exports: [TaskerooService],
})
export class TaskerooModule {}
