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
import { TaskBlueprintsService } from './task-blueprints.service';
import { CreateTaskBlueprintDto } from './dto/create-task-blueprint.dto';
import { UpdateTaskBlueprintDto } from './dto/update-task-blueprint.dto';
import { TaskBlueprintResponseDto } from './dto/task-blueprint-response.dto';
import { TaskBlueprintParamsDto } from './dto/task-blueprint-params.dto';
import { ListTaskBlueprintsQueryDto } from './dto/list-task-blueprints-query.dto';
import { TaskBlueprintListResponseDto } from './dto/task-blueprint-list-response.dto';
import { TaskResponseDto } from '../tasks/dto/task-response.dto';
import { AccessTokenGuard } from '../auth/guards/guards/access-token.guard';
import { ScopesGuard } from '../auth/guards/guards/scopes.guard';
import { RequireScopes } from '../auth/guards/decorators/require-scopes.decorator';
import { CurrentUser } from '../auth/guards/decorators/current-user.decorator';
import type { UserContext } from '../auth/guards/context/auth-context.types';
import { TasksScopes } from '../tasks/tasks.scopes';

@ApiTags('Task Blueprints')
@ApiCookieAuth('JWT-Cookie')
@Controller('task-blueprints')
@UseGuards(AccessTokenGuard, ScopesGuard)
@RequireScopes(TasksScopes.READ.id)
export class TaskBlueprintsController {
  constructor(private readonly taskBlueprintsService: TaskBlueprintsService) {}

  @Post()
  @RequireScopes(TasksScopes.WRITE.id)
  @ApiOperation({ summary: 'Create a new task blueprint' })
  @ApiCreatedResponse({
    type: TaskBlueprintResponseDto,
    description: 'Task blueprint created successfully',
  })
  @ApiBadRequestResponse({ description: 'Invalid input data' })
  async createTaskBlueprint(
    @Body() dto: CreateTaskBlueprintDto,
    @CurrentUser() user: UserContext,
  ): Promise<TaskBlueprintResponseDto> {
    const result = await this.taskBlueprintsService.createTaskBlueprint({
      name: dto.name,
      description: dto.description,
      assigneeActorId: dto.assigneeActorId,
      tagNames: dto.tagNames,
      dependsOnIds: dto.dependsOnIds,
      createdByActorId: user.actorId,
    });
    return TaskBlueprintResponseDto.fromResult(result);
  }

  @Get()
  @ApiOperation({ summary: 'List all task blueprints' })
  @ApiOkResponse({
    type: TaskBlueprintListResponseDto,
    description: 'Task blueprints retrieved successfully',
  })
  async listTaskBlueprints(
    @Query() query: ListTaskBlueprintsQueryDto,
  ): Promise<TaskBlueprintListResponseDto> {
    const result = await this.taskBlueprintsService.listTaskBlueprints({
      page: query.page ?? 1,
      limit: query.limit ?? 20,
    });
    return TaskBlueprintListResponseDto.fromResult(result);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a task blueprint by ID' })
  @ApiOkResponse({
    type: TaskBlueprintResponseDto,
    description: 'Task blueprint retrieved successfully',
  })
  @ApiNotFoundResponse({ description: 'Task blueprint not found' })
  async getTaskBlueprint(
    @Param() params: TaskBlueprintParamsDto,
  ): Promise<TaskBlueprintResponseDto> {
    const result = await this.taskBlueprintsService.getTaskBlueprintById(
      params.id,
    );
    return TaskBlueprintResponseDto.fromResult(result);
  }

  @Patch(':id')
  @RequireScopes(TasksScopes.WRITE.id)
  @ApiOperation({ summary: 'Update a task blueprint' })
  @ApiOkResponse({
    type: TaskBlueprintResponseDto,
    description: 'Task blueprint updated successfully',
  })
  @ApiNotFoundResponse({ description: 'Task blueprint not found' })
  @ApiBadRequestResponse({ description: 'Invalid input data' })
  async updateTaskBlueprint(
    @Param() params: TaskBlueprintParamsDto,
    @Body() dto: UpdateTaskBlueprintDto,
  ): Promise<TaskBlueprintResponseDto> {
    const result = await this.taskBlueprintsService.updateTaskBlueprint(
      params.id,
      {
        name: dto.name,
        description: dto.description,
        assigneeActorId: dto.assigneeActorId,
        tagNames: dto.tagNames,
        dependsOnIds: dto.dependsOnIds,
      },
    );
    return TaskBlueprintResponseDto.fromResult(result);
  }

  @Delete(':id')
  @RequireScopes(TasksScopes.WRITE.id)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a task blueprint' })
  @ApiNoContentResponse({ description: 'Task blueprint deleted successfully' })
  @ApiNotFoundResponse({ description: 'Task blueprint not found' })
  async deleteTaskBlueprint(
    @Param() params: TaskBlueprintParamsDto,
  ): Promise<void> {
    await this.taskBlueprintsService.deleteTaskBlueprint(params.id);
  }

  @Post(':id/create-task')
  @RequireScopes(TasksScopes.WRITE.id)
  @ApiOperation({ summary: 'Create a task from a blueprint' })
  @ApiCreatedResponse({
    type: TaskResponseDto,
    description: 'Task created from blueprint successfully',
  })
  @ApiNotFoundResponse({ description: 'Task blueprint not found' })
  async createTaskFromBlueprint(
    @Param() params: TaskBlueprintParamsDto,
  ): Promise<TaskResponseDto> {
    const result = await this.taskBlueprintsService.createTaskFromBlueprint(
      params.id,
    );
    return TaskResponseDto.fromResult(result);
  }
}
