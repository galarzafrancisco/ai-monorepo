import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { TaskerooModule } from './taskeroo/taskeroo.module';
import { WikirooModule } from './wikiroo/wikiroo.module';
import { McpRegistryModule } from './mcp-registry/mcp-registry.module';
import { AuthorizationServerModule } from './authorization-server/authorization-server.module';
import { DiscoveryModule } from './discovery/discovery.module';
import { AuthJourneysModule } from './auth-journeys/auth-journeys.module';
import { AgentsModule } from './agents/agents.module';
import { IdentityProviderModule } from './identity-provider/identity-provider.module';
import { LlmHelperModule } from './llm-helper/llm-helper.module';
import { getConfig } from './config/env.config';
import { AppInitModule } from './app-init/app-init.module';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'sqlite',
      database: getConfig().databasePath,
      entities: [__dirname + '/**/*.entity{.ts,.js}'],
      synchronize: true,
    }),
    EventEmitterModule.forRoot(),
    TaskerooModule,
    WikirooModule,
    McpRegistryModule,
    AuthJourneysModule,
    AuthorizationServerModule,
    DiscoveryModule,
    AgentsModule,
    IdentityProviderModule,
    LlmHelperModule,
    AppInitModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}