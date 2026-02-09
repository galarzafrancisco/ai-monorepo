import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThreadEntity } from './thread.entity';
import { ThreadsService } from './threads.service';
import { ThreadsController } from './threads.controller';
import { AuthGuardsModule } from '../auth/guards/auth-guards.module';
import { TaskEntity } from '../tasks/task.entity';
import { ContextBlockEntity } from '../context/block.entity';
import { ActorEntity } from '../identity-provider/actor.entity';
import { MetaModule } from '../meta/meta.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ThreadEntity,
      TaskEntity,
      ContextBlockEntity,
      ActorEntity,
    ]),
    AuthGuardsModule,
    MetaModule,
  ],
  controllers: [ThreadsController],
  providers: [ThreadsService],
  exports: [ThreadsService],
})
export class ThreadsModule {}
