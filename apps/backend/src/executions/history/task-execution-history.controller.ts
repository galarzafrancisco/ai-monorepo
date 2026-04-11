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
import { TaskExecutionHistoryService } from './task-execution-history.service';
import { TaskExecutionHistoryResponseDto } from './dto/http/task-execution-history-response.dto';

@ApiTags('Executions')
@ApiCookieAuth('JWT-Cookie')
@Controller('executions/history')
@UseGuards(AccessTokenGuard, ScopesGuard)
@RequireScopes(TasksScopes.READ.id)
export class TaskExecutionHistoryController {
  constructor(
    private readonly taskExecutionHistoryService: TaskExecutionHistoryService,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'List task execution history',
    description:
      'Returns the persisted execution history rows in the execution system.',
  })
  @ApiOkResponse({ type: [TaskExecutionHistoryResponseDto] })
  async listHistory(): Promise<TaskExecutionHistoryResponseDto[]> {
    const history = await this.taskExecutionHistoryService.listHistory();
    return history.map((entry) =>
      TaskExecutionHistoryResponseDto.fromEntity(entry),
    );
  }
}
