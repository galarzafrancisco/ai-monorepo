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
import { ThreadsService } from './threads.service';
import { CreateThreadDto } from './dto/create-thread.dto';
import { UpdateThreadDto } from './dto/update-thread.dto';
import { AttachTaskDto } from './dto/attach-task.dto';
import { ReferenceContextBlockDto } from './dto/reference-context-block.dto';
import { AddParticipantDto } from './dto/add-participant.dto';
import { ThreadParamsDto } from './dto/thread-params.dto';
import { ListThreadsQueryDto } from './dto/list-threads-query.dto';
import { ThreadResponseDto } from './dto/thread-response.dto';
import { ThreadListResponseDto } from './dto/thread-list-response.dto';
import { AccessTokenGuard } from '../auth/guards/guards/access-token.guard';
import { CurrentUser } from '../auth/guards/decorators/current-user.decorator';
import type { UserContext } from '../auth/guards/context/auth-context.types';
import { ScopesGuard } from 'src/auth/guards/guards/scopes.guard';
import { RequireScopes } from 'src/auth/guards/decorators/require-scopes.decorator';
import { ThreadsScopes } from './threads.scopes';
import { CreateTagDto } from '../meta/dto/create-tag.dto';

@ApiTags('Threads')
@ApiCookieAuth('JWT-Cookie')
@Controller('threads')
@UseGuards(AccessTokenGuard, ScopesGuard)
@RequireScopes(ThreadsScopes.READ.id)
export class ThreadsController {
  constructor(private readonly threadsService: ThreadsService) {}

  @Post()
  @RequireScopes(ThreadsScopes.WRITE.id)
  @ApiOperation({ summary: 'Create a new thread' })
  @ApiCreatedResponse({
    type: ThreadResponseDto,
    description: 'Thread created successfully',
  })
  @ApiBadRequestResponse({ description: 'Invalid input data' })
  async createThread(
    @Body() dto: CreateThreadDto,
    @CurrentUser() user: UserContext,
  ): Promise<ThreadResponseDto> {
    const result = await this.threadsService.createThread({
      title: dto.title,
      createdByActorId: user.actorId,
      tagNames: dto.tagNames,
      taskIds: dto.taskIds,
      contextBlockIds: dto.contextBlockIds,
      participantActorIds: dto.participantActorIds,
    });
    return ThreadResponseDto.fromResult(result);
  }

  @Patch(':id')
  @RequireScopes(ThreadsScopes.WRITE.id)
  @ApiOperation({ summary: 'Update thread title' })
  @ApiOkResponse({
    type: ThreadResponseDto,
    description: 'Thread updated successfully',
  })
  @ApiNotFoundResponse({ description: 'Thread not found' })
  @ApiBadRequestResponse({ description: 'Invalid input data' })
  async updateThread(
    @Param() params: ThreadParamsDto,
    @Body() dto: UpdateThreadDto,
    @CurrentUser() user: UserContext,
  ): Promise<ThreadResponseDto> {
    const result = await this.threadsService.updateThread(
      params.id,
      {
        title: dto.title,
      },
      user.actorId,
    );
    return ThreadResponseDto.fromResult(result);
  }

  @Get()
  @ApiOperation({
    summary: 'List all threads with lightweight retrieval',
  })
  @ApiOkResponse({
    type: ThreadListResponseDto,
    description: 'Paginated list of threads',
  })
  async listThreads(
    @Query() query: ListThreadsQueryDto,
  ): Promise<ThreadListResponseDto> {
    const result = await this.threadsService.listThreads({
      page: query.page ?? 1,
      limit: query.limit ?? 20,
    });

    return {
      items: result.items,
      total: result.total,
      page: result.page,
      limit: result.limit,
      totalPages: Math.ceil(result.total / result.limit),
    };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a thread by ID with full details' })
  @ApiOkResponse({ type: ThreadResponseDto, description: 'Thread found' })
  @ApiNotFoundResponse({ description: 'Thread not found' })
  async getThread(@Param() params: ThreadParamsDto): Promise<ThreadResponseDto> {
    const result = await this.threadsService.getThreadById(params.id);
    return ThreadResponseDto.fromResult(result);
  }

  @Post(':id/tasks')
  @RequireScopes(ThreadsScopes.WRITE.id)
  @ApiOperation({ summary: 'Attach a task to the thread' })
  @ApiCreatedResponse({
    type: ThreadResponseDto,
    description: 'Task attached successfully',
  })
  @ApiNotFoundResponse({ description: 'Thread or task not found' })
  @ApiBadRequestResponse({ description: 'Invalid input data' })
  async attachTask(
    @Param() params: ThreadParamsDto,
    @Body() dto: AttachTaskDto,
  ): Promise<ThreadResponseDto> {
    const result = await this.threadsService.attachTask(params.id, dto.taskId);
    return ThreadResponseDto.fromResult(result);
  }

  @Post(':id/context-blocks')
  @RequireScopes(ThreadsScopes.WRITE.id)
  @ApiOperation({ summary: 'Reference a context block in the thread' })
  @ApiCreatedResponse({
    type: ThreadResponseDto,
    description: 'Context block referenced successfully',
  })
  @ApiNotFoundResponse({ description: 'Thread or context block not found' })
  @ApiBadRequestResponse({ description: 'Invalid input data' })
  async referenceContextBlock(
    @Param() params: ThreadParamsDto,
    @Body() dto: ReferenceContextBlockDto,
  ): Promise<ThreadResponseDto> {
    const result = await this.threadsService.referenceContextBlock(
      params.id,
      dto.contextBlockId,
    );
    return ThreadResponseDto.fromResult(result);
  }

  @Post(':id/tags')
  @RequireScopes(ThreadsScopes.WRITE.id)
  @ApiOperation({ summary: 'Add a tag to a thread' })
  @ApiCreatedResponse({
    type: ThreadResponseDto,
    description: 'Tag added to thread successfully',
  })
  @ApiNotFoundResponse({ description: 'Thread not found' })
  @ApiBadRequestResponse({ description: 'Invalid input data' })
  async addTagToThread(
    @Param() params: ThreadParamsDto,
    @Body() dto: CreateTagDto,
    @CurrentUser() user: UserContext,
  ): Promise<ThreadResponseDto> {
    const result = await this.threadsService.addTagToThread(
      params.id,
      { name: dto.name },
      user.actorId,
    );
    return ThreadResponseDto.fromResult(result);
  }

  @Delete(':id/tags/:tagId')
  @RequireScopes(ThreadsScopes.WRITE.id)
  @ApiOperation({ summary: 'Remove a tag from a thread' })
  @ApiOkResponse({
    type: ThreadResponseDto,
    description: 'Tag removed from thread successfully',
  })
  @ApiNotFoundResponse({ description: 'Thread not found' })
  async removeTagFromThread(
    @Param('id') threadId: string,
    @Param('tagId') tagId: string,
    @CurrentUser() user: UserContext,
  ): Promise<ThreadResponseDto> {
    const result = await this.threadsService.removeTagFromThread(
      threadId,
      tagId,
      user.actorId,
    );
    return ThreadResponseDto.fromResult(result);
  }

  @Post(':id/participants')
  @RequireScopes(ThreadsScopes.WRITE.id)
  @ApiOperation({ summary: 'Add a participant to the thread' })
  @ApiCreatedResponse({
    type: ThreadResponseDto,
    description: 'Participant added successfully',
  })
  @ApiNotFoundResponse({ description: 'Thread or actor not found' })
  @ApiBadRequestResponse({ description: 'Invalid input data' })
  async addParticipant(
    @Param() params: ThreadParamsDto,
    @Body() dto: AddParticipantDto,
  ): Promise<ThreadResponseDto> {
    const result = await this.threadsService.addParticipant(
      params.id,
      dto.actorId,
    );
    return ThreadResponseDto.fromResult(result);
  }
}
