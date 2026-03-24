import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ScheduleModule } from '@nestjs/schedule';
import { TasksModule } from './tasks/tasks.module';
import { ContextModule } from './context/context.module';
import { McpRegistryModule } from './mcp-registry/mcp-registry.module';
import { AuthorizationServerModule } from './authorization-server/authorization-server.module';
import { DiscoveryModule } from './discovery/discovery.module';
import { AuthJourneysModule } from './auth-journeys/auth-journeys.module';
import { AgentsModule } from './agents/agents.module';
import { ThreadsModule } from './threads/threads.module';
import { IdentityProviderModule } from './identity-provider/identity-provider.module';
import { MetaModule } from './meta/meta.module';
import { AgentRunsModule } from './agent-runs/agent-runs.module';
import { getConfig } from './config/env.config';
import { AppInitModule } from './app-init/app-init.module';
import { TaskBlueprintsModule } from './task-blueprints/task-blueprints.module';
import { BaselineSchema1700000000000 } from './migrations/1700000000000-BaselineSchema';
import { AlignConnectionAuthFlowColumns1700000000001 } from './migrations/1700000000001-AlignConnectionAuthFlowColumns';
import { UpdateAgentTypeConstraint1700000000002 } from './migrations/1700000000002-UpdateAgentTypeConstraint';
import { AddTaskBlueprintsAndScheduledTasks1739500000000 } from './migrations/1739500000000-AddTaskBlueprintsAndScheduledTasks';
import { RefactorThreadsForHeadlessConversations1739750000000 } from './migrations/1739750000000-RefactorThreadsForHeadlessConversations';
import { RemoveRoleFromThreadMessage1739844333000 } from './migrations/1739844333000-RemoveRoleFromThreadMessage';
import { AddSecretsTable1740000000000 } from './migrations/1740000000000-AddSecretsTable';
import { AddChatSessionIdToThreads1741000000000 } from './migrations/1741000000000-AddChatSessionIdToThreads';
import { AddMcpServerTransportConfig1740500000000 } from './migrations/1740500000000-AddMcpServerTransportConfig';
import { AddTagUsageTable1741100000000 } from './migrations/1741100000000-AddTagUsageTable';
import { McpServerProvidedIdPartialUniqueIndex1741200000000 } from './migrations/1741200000000-McpServerProvidedIdPartialUniqueIndex';
import { AddHasSeenWalkthroughToUsers1741300000000 } from './migrations/1741300000000-AddHasSeenWalkthroughToUsers';
import { SecretsModule } from './secrets/secrets.module';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'sqlite',
      database: getConfig().databasePath,
      entities: [__dirname + '/**/*.entity{.ts,.js}'],
      synchronize: false,
      migrationsRun: true,
      migrations: [
        BaselineSchema1700000000000,
        AlignConnectionAuthFlowColumns1700000000001,
        UpdateAgentTypeConstraint1700000000002,
        AddTaskBlueprintsAndScheduledTasks1739500000000,
        RefactorThreadsForHeadlessConversations1739750000000,
        RemoveRoleFromThreadMessage1739844333000,
        AddSecretsTable1740000000000,
        AddMcpServerTransportConfig1740500000000,
        AddChatSessionIdToThreads1741000000000,
        AddTagUsageTable1741100000000,
        McpServerProvidedIdPartialUniqueIndex1741200000000,
        AddHasSeenWalkthroughToUsers1741300000000,
      ],
    }),
    EventEmitterModule.forRoot(),
    ScheduleModule.forRoot(),
    MetaModule,
    TasksModule,
    TaskBlueprintsModule,
    ContextModule,
    McpRegistryModule,
    AuthJourneysModule,
    AuthorizationServerModule,
    DiscoveryModule,
    AgentsModule,
    AgentRunsModule,
    ThreadsModule,
    IdentityProviderModule,
    AppInitModule,
    SecretsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule { }
