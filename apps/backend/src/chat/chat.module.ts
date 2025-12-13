import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SessionEntity } from './session.entity';
import { TaskEntity } from '../taskeroo/task.entity';
import { AgentEntity } from '../agents/agent.entity';
import { ChatService } from './chat.service';
import { ChatController } from './chat.controller';
import { ChatGateway } from './chat.gateway';
import { AdkModule } from '../adk/adk.module';
import { LlmHelperModule } from '../llm-helper/llm-helper.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([SessionEntity, TaskEntity, AgentEntity]),
    AdkModule,
    LlmHelperModule,
  ],
  controllers: [ChatController],
  providers: [ChatService, ChatGateway],
  exports: [ChatService],
})
export class ChatModule {}
