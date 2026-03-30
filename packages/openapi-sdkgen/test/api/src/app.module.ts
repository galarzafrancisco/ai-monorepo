import { Module } from '@nestjs/common';
import { UsersController } from './users.controller';
import { TasksController } from './tasks.controller';
import { StreamController } from './stream.controller';

@Module({
  controllers: [UsersController, TasksController, StreamController],
})
export class AppModule {}
