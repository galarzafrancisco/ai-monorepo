import { forwardRef, Module } from '@nestjs/common';
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
import { AdkBackend } from './backends/adk.backend';
import { OpenAiBackend } from './backends/openai.backend';
import { AgentsModule } from 'src/agents/agents.module';
import { AuthorizationServerModule } from 'src/authorization-server/authorization-server.module';
import { OpenAiMcpServerFactoryService } from './openai-mcp-server-factory.service';
import { ThreadTitleService } from './thread-title.service';
import { ThreadStateReconcilerService } from './thread-state-reconciler.service';
import { ChatProvidersModule } from '../chat-providers/chat-providers.module';
import { ThreadTaskAssignmentProjectorService } from './thread-task-assignment-projector.service';
import { OutboxModule } from '../outbox/outbox.module';
import { UpdateThreadUseCase } from './use-cases/update-thread.use-case';
import { DeleteThreadUseCase } from './use-cases/delete-thread.use-case';
import { ThreadOutboxProjectorService } from './thread-outbox-projector.service';
import { CreateThreadUseCase } from './use-cases/create-thread.use-case';
import { ChangeThreadTagUseCase } from './use-cases/change-thread-tag.use-case';
import { ChangeThreadTaskUseCase } from './use-cases/change-thread-task.use-case';
import { ChangeThreadRelationsUseCase } from './use-cases/change-thread-relations.use-case';
import { CreateThreadMessageUseCase } from './use-cases/create-thread-message.use-case';

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
    AuthGuardsModule,
    MetaModule,
    forwardRef(() => ContextModule),
    ChatProvidersModule,
    OutboxModule,
  ],
  controllers: [ThreadsController],
  providers: [
    ThreadsService,
    ThreadsGateway,
    ChatService,
    AdkBackend,
    OpenAiBackend,
    OpenAiMcpServerFactoryService,
    ThreadTitleService,
    ThreadStateReconcilerService,
    ThreadTaskAssignmentProjectorService,
    UpdateThreadUseCase,
    DeleteThreadUseCase,
    ThreadOutboxProjectorService,
    CreateThreadUseCase,
    ChangeThreadTagUseCase,
    ChangeThreadTaskUseCase,
    ChangeThreadRelationsUseCase,
    CreateThreadMessageUseCase,
  ],
  exports: [ThreadsService],
})
export class ThreadsModule {}
