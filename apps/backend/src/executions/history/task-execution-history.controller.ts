import {
  Controller,
  Get,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiCookieAuth,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { TaskExecutionHistoryEntryNotFoundError } from '../errors/executions.errors';
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

  @Get(':id')
  @ApiOperation({
    summary: 'Get one finished execution',
    description:
      'Returns a single execution history row by id, including runs older than the latest page of history.',
  })
  @ApiOkResponse({ type: TaskExecutionHistoryResponseDto })
  @ApiNotFoundResponse({ description: 'Execution not found' })
  async getHistoryEntry(
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<TaskExecutionHistoryResponseDto> {
    try {
      return TaskExecutionHistoryResponseDto.fromResult(
        await this.taskExecutionHistoryService.getHistoryEntry(id),
      );
    } catch (error) {
      if (error instanceof TaskExecutionHistoryEntryNotFoundError)
        throw new NotFoundException(error.message);
      throw error;
    }
  }
}
