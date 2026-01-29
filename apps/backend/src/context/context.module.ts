import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ContextService } from './context.service';
import { ContextController } from './context.controller';
import { ContextBlockEntity } from './block.entity';
import { ContextMcpGateway } from './context.mcp.gateway';
import { ContextGateway } from './context.gateway';
import { AuthorizationServerModule } from '../authorization-server/authorization-server.module';
import { AuthGuardsModule } from '../auth/guards/auth-guards.module';
import { MetaModule } from '../meta/meta.module';
import { IdentityProviderModule } from 'src/identity-provider/identity-provider.module';
import { SearchModule } from 'src/search/search.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([ContextBlockEntity]),
    AuthorizationServerModule,
    AuthGuardsModule,
    IdentityProviderModule,
    MetaModule,
    SearchModule,
  ],
  controllers: [ContextController],
  providers: [ContextService, ContextMcpGateway, ContextGateway],
  exports: [ContextService],
})
export class ContextModule {}
