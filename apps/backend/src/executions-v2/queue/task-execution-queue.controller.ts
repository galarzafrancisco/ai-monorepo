import { Controller, Get, UseGuards } from '@nestjs/common';
import {
  ApiCookieAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { AccessTokenGuard } from '../../auth/guards/guards/access-token.guard';
import { ScopesGuard } from '../../auth/guards/guards/scopes.guard';
import { RequireScopes } from '../../auth/guards/decorators/require-scopes.decorator';
import { TasksScopes } from '../../tasks/tasks.scopes';
import { TaskExecutionQueueService } from './task-execution-queue.service';
import { TaskExecutionQueueEntryResponseDto } from './dto/http/task-execution-queue-entry-response.dto';

@ApiTags('Executions V2')
@ApiCookieAuth('JWT-Cookie')
@Controller('executions-v2/queue')
@UseGuards(AccessTokenGuard, ScopesGuard)
@RequireScopes(TasksScopes.READ.id)
export class TaskExecutionQueueController {
  constructor(
    private readonly taskExecutionQueueService: TaskExecutionQueueService,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'List the current task execution work queue',
    description:
      'Returns the tasks currently present in the v2 execution queue. ' +
      'Presence means the task is ready to be picked by the executor.',
  })
  @ApiOkResponse({ type: [TaskExecutionQueueEntryResponseDto] })
  async listQueue(): Promise<TaskExecutionQueueEntryResponseDto[]> {
    const queue = await this.taskExecutionQueueService.listQueue();
    return queue.map((entry) =>
      TaskExecutionQueueEntryResponseDto.fromEntity(entry),
    );
  }
}
