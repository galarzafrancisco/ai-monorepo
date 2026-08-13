import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TaskEntity } from './task.entity';
import { CommentEntity } from './comment.entity';
import { ArtefactEntity } from './artefact.entity';
import { InputRequestEntity } from './input-request.entity';
import { TasksService } from './tasks.service';
import { TasksController } from './tasks.controller';
import { TasksGateway } from './tasks.gateway';
import { TasksMcpGateway } from './tasks.mcp.gateway';
import { AuthorizationServerModule } from '../authorization-server/authorization-server.module';
import { AuthGuardsModule } from '../auth/guards/auth-guards.module';
import { IdentityProviderModule } from '../identity-provider/identity-provider.module';
import { MetaModule } from '../meta/meta.module';
import { SearchModule } from '../search/search.module';
import { AgentRunsModule } from '../agent-runs/agent-runs.module';
import { ThreadsModule } from '../threads/threads.module';
import { ExecutionsModule } from '../executions/executions.module';
import { ChangeTaskStatusUseCase } from './use-cases/change-task-status.use-case';
import { CreateTaskUseCase } from './use-cases/create-task.use-case';
import { UpdateTaskUseCase } from './use-cases/update-task.use-case';
import { DeleteTaskUseCase } from './use-cases/delete-task.use-case';
import { AssignTaskUseCase } from './use-cases/assign-task.use-case';
import { AddTaskCommentUseCase } from './use-cases/add-task-comment.use-case';
import { CreateInputRequestUseCase } from './use-cases/create-input-request.use-case';
import { AnswerInputRequestUseCase } from './use-cases/answer-input-request.use-case';
import { AddTaskArtefactUseCase } from './use-cases/add-task-artefact.use-case';
import { ChangeTaskTagUseCase } from './use-cases/change-task-tag.use-case';
import { OutboxModule } from '../outbox/outbox.module';
import { TaskOutboxProjectorService } from './task-outbox-projector.service';
import { CreateTaskInThreadUseCase } from './use-cases/create-task-in-thread.use-case';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      TaskEntity,
      CommentEntity,
      ArtefactEntity,
      InputRequestEntity,
    ]),
    AuthorizationServerModule,
    AuthGuardsModule,
    IdentityProviderModule,
    MetaModule,
    SearchModule,
    AgentRunsModule,
    ThreadsModule,
    ExecutionsModule,
    OutboxModule,
  ],
  controllers: [TasksController],
  providers: [
    TasksService,
    TasksGateway,
    TasksMcpGateway,
    ChangeTaskStatusUseCase,
    CreateTaskUseCase,
    UpdateTaskUseCase,
    DeleteTaskUseCase,
    AssignTaskUseCase,
    AddTaskCommentUseCase,
    CreateInputRequestUseCase,
    AnswerInputRequestUseCase,
    AddTaskArtefactUseCase,
    ChangeTaskTagUseCase,
    TaskOutboxProjectorService,
    CreateTaskInThreadUseCase,
  ],
  exports: [TasksService],
})
export class TasksModule {}
