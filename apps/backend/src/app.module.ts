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
import { SplitSmallTasksSelection1761700000000 } from './migrations/1761700000000-SplitSmallTasksSelection';
import { ThreadTimers1761800000000 } from './migrations/1761800000000-ThreadTimers';
import { DedupeArtefacts1761900000000 } from './migrations/1761900000000-DedupeArtefacts';
import { ThreadPins1762000000000 } from './migrations/1762000000000-ThreadPins';
import { ThreadMessageTimezone1762100000000 } from './migrations/1762100000000-ThreadMessageTimezone';
import { ThreadHardDelete1762200000000 } from './migrations/1762200000000-ThreadHardDelete';
import { SecretsModule } from './secrets/secrets.module';
import { AiProvidersModule } from './ai-providers/ai-providers.module';
import { IntegrationsModule } from './integrations/integrations.module';
import { PullRequestsModule } from './pull-requests/pull-requests.module';
import { ExecutionsModule } from './executions/executions.module';
import { GlobalSearchModule } from './global-search/global-search.module';
import { WorkersModule } from './workers/workers.module';
import { AccessRequestsModule } from './access-requests/access-requests.module';
import { AccessRequests1762300000000 } from './migrations/1762300000000-AccessRequests';
import { AccessRequestHeardFrom1762400000000 } from './migrations/1762400000000-AccessRequestHeardFrom';
import { WalkthroughModule } from './walkthrough/walkthrough.module';
import { ExecutionTraceSource1762500000002 } from './migrations/1762500000002-ExecutionTraceSource';
import { GithubConnections1762600000000 } from './migrations/1762600000000-GithubConnections';
import { PullRequests1762700000000 } from './migrations/1762700000000-PullRequests';
import { ThreadWatches1762800000000 } from './migrations/1762800000000-ThreadWatches';
import { GithubEnterprise1762900000000 } from './migrations/1762900000000-GithubEnterprise';
import { GithubWebhookSources1762950000000 } from './migrations/1762950000000-GithubWebhookSources';
import { ExecutionTraceJson1762500000001 } from './migrations/1762500000001-ExecutionTraceJson';
import { ExecutionTraces1762500000000 } from './migrations/1762500000000-ExecutionTraces';
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
        SplitSmallTasksSelection1761700000000,
        ThreadTimers1761800000000,
        DedupeArtefacts1761900000000,
        ThreadPins1762000000000,
        ThreadMessageTimezone1762100000000,
        ThreadHardDelete1762200000000,
        AccessRequests1762300000000,
        AccessRequestHeardFrom1762400000000,
        ExecutionTraces1762500000000,
        ExecutionTraceJson1762500000001,
        ExecutionTraceSource1762500000002,
        GithubConnections1762600000000,
        PullRequests1762700000000,
        ThreadWatches1762800000000,
        GithubEnterprise1762900000000,
        GithubWebhookSources1762950000000,
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
    IntegrationsModule,
    PullRequestsModule,
    ExecutionsModule,
    WorkersModule,
    GlobalSearchModule,
    WalkthroughModule,
    AccessRequestsModule,
  ],
  controllers: [AppController],
  providers: [AppService, ServerLifecycleService],
})
export class AppModule { }
