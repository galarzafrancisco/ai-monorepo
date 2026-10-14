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
import { getConfig, isTypeormSchemaSyncEnabled } from './config/env.config';
import { AppInitModule } from './app-init/app-init.module';
import { TaskBlueprintsModule } from './task-blueprints/task-blueprints.module';
import { PostgresBaseline1750000000000 } from './migrations/1750000000000-PostgresBaseline';
import { ThreadAgentMessages1760200000000 } from './migrations/1760200000000-ThreadAgentMessages';
import { ChatProviderModelConfig1760300000000 } from './migrations/1760300000000-ChatProviderModelConfig';
import { ReplaceAdkChatProvider1760400000000 } from './migrations/1760400000000-ReplaceAdkChatProvider';
import { AiProviderModelSelections1760500000000 } from './migrations/1760500000000-AiProviderModelSelections';
import { DropAdkSessionTables1760600000000 } from './migrations/1760600000000-DropAdkSessionTables';
import { McpClientIdMetadataDocuments1760700000000 } from './migrations/1760700000000-McpClientIdMetadataDocuments';
import { McpClientPrivateKeyJwt1760800000000 } from './migrations/1760800000000-McpClientPrivateKeyJwt';
import { ActorSoftDelete1760900000000 } from './migrations/1760900000000-ActorSoftDelete';
import { ThreadTaskSubscriptions1761000000000 } from './migrations/1761000000000-ThreadTaskSubscriptions';
import { ThreadTaskSubscriptionWaitingFor1761100000000 } from './migrations/1761100000000-ThreadTaskSubscriptionWaitingFor';
import { SearchIndex1761200000000 } from './migrations/1761200000000-SearchIndex';
import { ThreadSecret1761300000000 } from './migrations/1761300000000-ThreadSecret';
import { ThreadReadStates1761400000000 } from './migrations/1761400000000-ThreadReadStates';
import { ThreadLastActivity1761500000000 } from './migrations/1761500000000-ThreadLastActivity';
import { AiProviderConnections1761600000000 } from './migrations/1761600000000-AiProviderConnections';
import { SecretsModule } from './secrets/secrets.module';
import { AiProvidersModule } from './ai-providers/ai-providers.module';
import { ExecutionsModule } from './executions/executions.module';
import { GlobalSearchModule } from './global-search/global-search.module';
import { WorkersModule } from './workers/workers.module';
import { WalkthroughModule } from './walkthrough/walkthrough.module';
import { ServerLifecycleService } from './server-lifecycle.service';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'postgres',
      url: getConfig().databaseUrl,
      uuidExtension: 'pgcrypto',
      ssl: getConfig().databaseSsl ? { rejectUnauthorized: true } : false,
      entities: [__dirname + '/**/*.entity{.ts,.js}'],
      synchronize: isTypeormSchemaSyncEnabled(),
      migrationsRun: !isTypeormSchemaSyncEnabled(),
      migrations: [
        PostgresBaseline1750000000000,
        ThreadAgentMessages1760200000000,
        ChatProviderModelConfig1760300000000,
        ReplaceAdkChatProvider1760400000000,
        AiProviderModelSelections1760500000000,
        DropAdkSessionTables1760600000000,
        McpClientIdMetadataDocuments1760700000000,
        McpClientPrivateKeyJwt1760800000000,
        ActorSoftDelete1760900000000,
        ThreadTaskSubscriptions1761000000000,
        ThreadTaskSubscriptionWaitingFor1761100000000,
        SearchIndex1761200000000,
        ThreadSecret1761300000000,
        ThreadReadStates1761400000000,
        ThreadLastActivity1761500000000,
        AiProviderConnections1761600000000,
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
    AiProvidersModule,
    ExecutionsModule,
    WorkersModule,
    GlobalSearchModule,
    WalkthroughModule,
  ],
  controllers: [AppController],
  providers: [AppService, ServerLifecycleService],
})
export class AppModule { }
