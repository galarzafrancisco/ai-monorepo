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
import { ThreadAgentMessageEntity } from './agent/thread-agent-message.entity';
import { ThreadTurnEntity } from './agent/thread-turn.entity';
import { ThreadAgentService } from './agent/thread-agent.service';
import { ThreadAgentLogService } from './agent/thread-agent-log.service';
import { ThreadTurnsService } from './agent/thread-turns.service';
import { ChatModelFactory } from './agent/chat-model.factory';
import { TaicoMcpToolsFactory } from './agent/taico-mcp-tools.factory';
import { THREAD_AGENT_HOOKS } from './agent/hooks/thread-agent-hook.interface';
import { ThreadAgentHooksRunner } from './agent/hooks/thread-agent-hooks.runner';
import { EasterEggHook } from './agent/hooks/easter-egg.hook';
import { CompactionHook } from './agent/hooks/compaction.hook';
import { AgentsModule } from 'src/agents/agents.module';
import { AuthorizationServerModule } from 'src/authorization-server/authorization-server.module';
import { ThreadTitleService } from './thread-title.service';
import { ThreadStateReconcilerService } from './thread-state-reconciler.service';
import { ChatProvidersModule } from '../chat-providers/chat-providers.module';
import { ThreadTaskAssignmentProjectorService } from './thread-task-assignment-projector.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ThreadEntity,
      ThreadMessageEntity,
      ThreadAgentMessageEntity,
      ThreadTurnEntity,
      TaskEntity,
      ContextBlockEntity,
      ActorEntity,
      AgentRunEntity,
    ]),
    AgentsModule,
    AuthorizationServerModule,
    AuthGuardsModule,
    MetaModule,
    ContextModule,
    ChatProvidersModule,
  ],
  controllers: [ThreadsController],
  providers: [
    ThreadsService,
    ThreadsGateway,
    ChatService,
    ThreadAgentService,
    ThreadAgentLogService,
    ThreadTurnsService,
    ChatModelFactory,
    TaicoMcpToolsFactory,
    ThreadAgentHooksRunner,
    EasterEggHook,
    CompactionHook,
    {
      // Hooks run in this order.
      provide: THREAD_AGENT_HOOKS,
      useFactory: (easterEgg: EasterEggHook, compaction: CompactionHook) => [
        easterEgg,
        compaction,
      ],
      inject: [EasterEggHook, CompactionHook],
    },
    ThreadTitleService,
    ThreadStateReconcilerService,
    ThreadTaskAssignmentProjectorService,
  ],
  exports: [ThreadsService],
})
export class ThreadsModule {}
