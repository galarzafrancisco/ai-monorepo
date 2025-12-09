import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SessionEntity } from './session.entity';
import { TaskEntity } from '../taskeroo/task.entity';
import { AgentEntity } from '../agents/agent.entity';
import { ChatService } from './chat.service';
import { ChatController } from './chat.controller';
import { AdkModule } from '../adk/adk.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([SessionEntity, TaskEntity, AgentEntity]),
    AdkModule,
  ],
  controllers: [ChatController],
  providers: [ChatService],
  exports: [ChatService],
})
export class ChatModule {}
