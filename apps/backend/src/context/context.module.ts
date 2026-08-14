import { forwardRef, Module } from '@nestjs/common';
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
import { OutboxModule } from '../outbox/outbox.module';
import { CreateContextBlockUseCase } from './use-cases/create-context-block.use-case';
import { ContextOutboxProjectorService } from './context-outbox-projector.service';
import { UpdateContextBlockUseCase } from './use-cases/update-context-block.use-case';
import { AppendContextBlockUseCase } from './use-cases/append-context-block.use-case';
import { DeleteContextBlockUseCase } from './use-cases/delete-context-block.use-case';
import { ChangeContextBlockTagUseCase } from './use-cases/change-context-block-tag.use-case';
import { MoveContextBlockUseCase } from './use-cases/move-context-block.use-case';
import { ImportContextBlockTreeUseCase } from './use-cases/import-context-block-tree.use-case';
import { ThreadsModule } from '../threads/threads.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([ContextBlockEntity]),
    AuthorizationServerModule,
    AuthGuardsModule,
    IdentityProviderModule,
    MetaModule,
    SearchModule,
    OutboxModule,
    forwardRef(() => ThreadsModule),
  ],
  controllers: [ContextController],
  providers: [
    ContextService,
    ContextMcpGateway,
    ContextGateway,
    CreateContextBlockUseCase,
    ContextOutboxProjectorService,
    UpdateContextBlockUseCase,
    AppendContextBlockUseCase,
    DeleteContextBlockUseCase,
    ChangeContextBlockTagUseCase,
    MoveContextBlockUseCase,
    ImportContextBlockTreeUseCase,
  ],
  exports: [ContextService],
})
export class ContextModule {}
