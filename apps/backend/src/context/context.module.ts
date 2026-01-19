import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ContextService } from './context.service';
import { ContextController } from './context.controller';
import { ContextPageEntity } from './page.entity';
import { ContextTagEntity } from './tag.entity';
import { ContextMcpGateway } from './context.mcp.gateway';
import { ContextGateway } from './context.gateway';
import { AuthorizationServerModule } from '../authorization-server/authorization-server.module';
import { AuthGuardsModule } from '../auth/guards/auth-guards.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([ContextPageEntity, ContextTagEntity]),
    AuthorizationServerModule,
    AuthGuardsModule,
  ],
  controllers: [ContextController],
  providers: [ContextService, ContextMcpGateway, ContextGateway],
  exports: [ContextService],
})
export class ContextModule {}
