import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Task } from './task.entity';
import { Comment } from './comment.entity';
import { TaskerooService } from './taskeroo.service';
import { TaskerooController } from './taskeroo.controller';
import { TaskerooGateway } from './taskeroo.gateway';

@Module({
  imports: [TypeOrmModule.forFeature([Task, Comment])],
  controllers: [TaskerooController],
  providers: [TaskerooService, TaskerooGateway],
  exports: [TaskerooService],
})
export class TaskerooModule {}
