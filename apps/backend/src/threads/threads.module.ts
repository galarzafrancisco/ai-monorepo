import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThreadEntity } from './thread.entity';
import { ThreadMessageEntity } from './thread-message.entity';
import { ThreadsService } from './threads.service';
import { ThreadsController } from './threads.controller';
import { ThreadsGateway } from './threads.gateway';
import { AuthGuardsModule } from '../auth/guards/auth-guards.module';
import { TaskEntity } from '../tasks/task.entity';
import { ContextBlockEntity } from '../context/block.entity';
import { ActorEntity } from '../identity-provider/actor.entity';
import { MetaModule } from '../meta/meta.module';
import { AgentRunEntity } from '../agent-runs/agent-run.entity';
import { ContextModule } from '../context/context.module';
import { ChatService } from './chat.service';
import { AgentsModule } from 'src/agents/agents.module';
import { AuthorizationServerModule } from 'src/authorization-server/authorization-server.module';
import { OpenAiMcpServerFactoryService } from './openai-mcp-server-factory.service';
import { LlmModule } from '../llm/llm.module';
import { ThreadTitleService } from './thread-title.service';
import { ThreadStateReconcilerService } from './thread-state-reconciler.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ThreadEntity,
      ThreadMessageEntity,
      TaskEntity,
      ContextBlockEntity,
      ActorEntity,
      AgentRunEntity,
    ]),
    AgentsModule,
    AuthorizationServerModule,
    LlmModule,
    AuthGuardsModule,
    MetaModule,
    ContextModule,
  ],
  controllers: [ThreadsController],
  providers: [
    ThreadsService,
    ThreadsGateway,
    ChatService,
    OpenAiMcpServerFactoryService,
    ThreadTitleService,
    ThreadStateReconcilerService,
  ],
  exports: [ThreadsService],
})
export class ThreadsModule {}
