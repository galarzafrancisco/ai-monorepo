import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThreadEntity } from './thread.entity';
import { ThreadMessageEntity } from './thread-message.entity';
import { ThreadsService } from './threads.service';
import { ThreadsController } from './threads.controller';
import { AuthGuardsModule } from '../auth/guards/auth-guards.module';
import { TaskEntity } from '../tasks/task.entity';
import { ContextBlockEntity } from '../context/block.entity';
import { ActorEntity } from '../identity-provider/actor.entity';
import { MetaModule } from '../meta/meta.module';
import { AgentRunEntity } from '../agent-runs/agent-run.entity';
import { ContextModule } from '../context/context.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ThreadEntity,
      ThreadMessageEntity,
      TaskEntity,
      ContextBlockEntity,
      ActorEntity,
      AgentRunEntity,
    ]),
    AuthGuardsModule,
    MetaModule,
    ContextModule,
  ],
  controllers: [ThreadsController],
  providers: [ThreadsService],
  exports: [ThreadsService],
})
export class ThreadsModule {}
