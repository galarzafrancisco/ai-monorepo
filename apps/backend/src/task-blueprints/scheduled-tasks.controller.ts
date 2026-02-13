import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiOkResponse,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiBadRequestResponse,
  ApiNotFoundResponse,
  ApiCookieAuth,
} from '@nestjs/swagger';
import { ScheduledTasksService } from './scheduled-tasks.service';
import { CreateScheduledTaskDto } from './dto/create-scheduled-task.dto';
import { UpdateScheduledTaskDto } from './dto/update-scheduled-task.dto';
import { ScheduledTaskResponseDto } from './dto/scheduled-task-response.dto';
import { ScheduledTaskParamsDto } from './dto/scheduled-task-params.dto';
import { ListScheduledTasksQueryDto } from './dto/list-scheduled-tasks-query.dto';
import { ScheduledTaskListResponseDto } from './dto/scheduled-task-list-response.dto';
import { AccessTokenGuard } from '../auth/guards/guards/access-token.guard';
import { ScopesGuard } from '../auth/guards/guards/scopes.guard';
import { RequireScopes } from '../auth/guards/decorators/require-scopes.decorator';
import { TasksScopes } from '../tasks/tasks.scopes';

@ApiTags('Scheduled Tasks')
@ApiCookieAuth('JWT-Cookie')
@Controller('scheduled-tasks')
@UseGuards(AccessTokenGuard, ScopesGuard)
@RequireScopes(TasksScopes.READ.id)
export class ScheduledTasksController {
  constructor(private readonly scheduledTasksService: ScheduledTasksService) {}

  @Post()
  @RequireScopes(TasksScopes.WRITE.id)
  @ApiOperation({ summary: 'Create a new scheduled task' })
  @ApiCreatedResponse({
    type: ScheduledTaskResponseDto,
    description: 'Scheduled task created successfully',
  })
  @ApiBadRequestResponse({ description: 'Invalid input data' })
  async createScheduledTask(
    @Body() dto: CreateScheduledTaskDto,
  ): Promise<ScheduledTaskResponseDto> {
    const result = await this.scheduledTasksService.createScheduledTask({
      taskBlueprintId: dto.taskBlueprintId,
      cronExpression: dto.cronExpression,
      enabled: dto.enabled,
    });
    return ScheduledTaskResponseDto.fromResult(result);
  }

  @Get()
  @ApiOperation({ summary: 'List all scheduled tasks' })
  @ApiOkResponse({
    type: ScheduledTaskListResponseDto,
    description: 'Scheduled tasks retrieved successfully',
  })
  async listScheduledTasks(
    @Query() query: ListScheduledTasksQueryDto,
  ): Promise<ScheduledTaskListResponseDto> {
    const result = await this.scheduledTasksService.listScheduledTasks({
      page: query.page ?? 1,
      limit: query.limit ?? 20,
      enabled: query.enabled,
    });
    return ScheduledTaskListResponseDto.fromResult(result);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a scheduled task by ID' })
  @ApiOkResponse({
    type: ScheduledTaskResponseDto,
    description: 'Scheduled task retrieved successfully',
  })
  @ApiNotFoundResponse({ description: 'Scheduled task not found' })
  async getScheduledTask(
    @Param() params: ScheduledTaskParamsDto,
  ): Promise<ScheduledTaskResponseDto> {
    const result = await this.scheduledTasksService.getScheduledTaskById(
      params.id,
    );
    return ScheduledTaskResponseDto.fromResult(result);
  }

  @Patch(':id')
  @RequireScopes(TasksScopes.WRITE.id)
  @ApiOperation({ summary: 'Update a scheduled task' })
  @ApiOkResponse({
    type: ScheduledTaskResponseDto,
    description: 'Scheduled task updated successfully',
  })
  @ApiNotFoundResponse({ description: 'Scheduled task not found' })
  @ApiBadRequestResponse({ description: 'Invalid input data' })
  async updateScheduledTask(
    @Param() params: ScheduledTaskParamsDto,
    @Body() dto: UpdateScheduledTaskDto,
  ): Promise<ScheduledTaskResponseDto> {
    const result = await this.scheduledTasksService.updateScheduledTask(
      params.id,
      {
        cronExpression: dto.cronExpression,
        enabled: dto.enabled,
      },
    );
    return ScheduledTaskResponseDto.fromResult(result);
  }

  @Delete(':id')
  @RequireScopes(TasksScopes.WRITE.id)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a scheduled task' })
  @ApiNoContentResponse({
    description: 'Scheduled task deleted successfully',
  })
  @ApiNotFoundResponse({ description: 'Scheduled task not found' })
  async deleteScheduledTask(
    @Param() params: ScheduledTaskParamsDto,
  ): Promise<void> {
    await this.scheduledTasksService.deleteScheduledTask(params.id);
  }
}
