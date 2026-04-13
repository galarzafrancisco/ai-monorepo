import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AgentEntity } from '../agents/agent.entity';
import { AuthGuardsModule } from '../auth/guards/auth-guards.module';
import { ContextBlockEntity } from '../context/block.entity';
import { User } from '../identity-provider/user.entity';
import { ProjectEntity } from '../meta/project.entity';
import { TaskEntity } from '../tasks/task.entity';
import { ThreadEntity } from '../threads/thread.entity';
import { WorkerEntity } from '../workers/worker.entity';
import { WalkthroughController } from './walkthrough.controller';
import { WalkthroughService } from './walkthrough.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      User,
      WorkerEntity,
      AgentEntity,
      TaskEntity,
      ProjectEntity,
      ContextBlockEntity,
      ThreadEntity,
    ]),
    AuthGuardsModule,
  ],
  controllers: [WalkthroughController],
  providers: [WalkthroughService],
})
export class WalkthroughModule {}
