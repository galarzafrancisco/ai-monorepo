import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AgentsModule } from 'src/agents/agents.module';
import { AppInitRunner } from './app-init.runner';
import { McpRegistryModule } from 'src/mcp-registry/mcp-registry.module';
import { IdentityProviderModule } from 'src/identity-provider/identity-provider.module';
import { User } from 'src/identity-provider/user.entity';
import { ActorEntity } from 'src/identity-provider/actor.entity';
import { AgentEntity } from 'src/agents/agent.entity';
import { MetaModule } from 'src/meta/meta.module';
import { ContextModule } from 'src/context/context.module';
import { ChatProvidersModule } from 'src/chat-providers/chat-providers.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, ActorEntity, AgentEntity]),
    AgentsModule,
    McpRegistryModule,
    IdentityProviderModule,
    MetaModule,
    ContextModule,
    ChatProvidersModule,
  ],
  providers: [AppInitRunner],
  exports: [AppInitRunner],
})
export class AppInitModule {}
