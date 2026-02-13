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
import { AddTaskBlueprintsAndScheduledTasks1739500000000 } from './migrations/1739500000000-AddTaskBlueprintsAndScheduledTasks';

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
        AddTaskBlueprintsAndScheduledTasks1739500000000,
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
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
