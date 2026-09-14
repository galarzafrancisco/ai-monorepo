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
import { AddActorDeactivatedAt1760000000000 } from './migrations/1760000000000-AddActorDeactivatedAt';
import { SecretsModule } from './secrets/secrets.module';
import { ChatProvidersModule } from './chat-providers/chat-providers.module';
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
        AddActorDeactivatedAt1760000000000,
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
    ChatProvidersModule,
    ExecutionsModule,
    WorkersModule,
    GlobalSearchModule,
    WalkthroughModule,
  ],
  controllers: [AppController],
  providers: [AppService, ServerLifecycleService],
})
export class AppModule {}
