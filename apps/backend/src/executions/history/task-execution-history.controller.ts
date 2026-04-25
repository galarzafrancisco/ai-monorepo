import { Controller, Get, Query, UseGuards } from '@nestjs/common';
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
import { TaskExecutionHistoryListResponseDto } from './dto/http/task-execution-history-list-response.dto';
import { ListHistoryQueryDto } from './dto/http/list-history-query.dto';

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
      'Returns the persisted execution history rows in the execution system with pagination.',
  })
  @ApiOkResponse({ type: TaskExecutionHistoryListResponseDto })
  async listHistory(
    @Query() query: ListHistoryQueryDto,
  ): Promise<TaskExecutionHistoryListResponseDto> {
    const result = await this.taskExecutionHistoryService.listHistory({
      page: query.page ?? 1,
      limit: query.limit ?? 50,
      taskId: query.taskId,
    });

    return {
      items: result.items.map((item) =>
        TaskExecutionHistoryResponseDto.fromResult(item),
      ),
      total: result.total,
      page: result.page,
      limit: result.limit,
      totalPages: Math.ceil(result.total / result.limit),
    };
  }
}
