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
  Sse,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiOkResponse,
  ApiCreatedResponse,
} from '@nestjs/swagger';
import { Observable, from } from 'rxjs';
import { ChatService } from './chat.service';
import { CreateSessionDto } from './dto/create-session.dto';
import { UpdateSessionDto } from './dto/update-session.dto';
import { ChatSessionResponseDto } from './dto/session-response.dto';
import { SessionListResponseDto } from './dto/session-list-response.dto';
import { ListSessionsQueryDto } from './dto/list-sessions-query.dto';
import { SessionParamsDto } from './dto/session-params.dto';
import {
  SessionResult,
  TaskResult,
} from './dto/service/chat.service.types';
import { TaskResponseDto } from './dto/task-response.dto';
import { ChatSendMessageDto } from './dto/send-message.dto';
import { SendMessageResponseDto } from './dto/message-response.dto';

@ApiTags('Chat')
@Controller('chat/sessions')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new chat session' })
  @ApiCreatedResponse({ type: ChatSessionResponseDto })
  async createSession(
    @Body() dto: CreateSessionDto,
  ): Promise<ChatSessionResponseDto> {
    const result = await this.chatService.createSession({
      agentId: dto.agentId,
      title: dto.title,
      project: dto.project,
    });
    return this.mapSessionToResponse(result);
  }

  @Get()
  @ApiOperation({
    summary: 'List chat sessions with optional filtering and pagination',
  })
  @ApiOkResponse({ type: SessionListResponseDto })
  async listSessions(
    @Query() query: ListSessionsQueryDto,
  ): Promise<SessionListResponseDto> {
    const result = await this.chatService.listSessions({
      agentId: query.agentId,
      project: query.project,
      isArchived: query.isArchived,
      isPinned: query.isPinned,
      page: query.page ?? 1,
      limit: query.limit ?? 20,
    });

    return {
      items: result.items.map((item) => this.mapSessionToResponse(item)),
      total: result.total,
      page: result.page,
      limit: result.limit,
    };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a chat session by ID' })
  @ApiOkResponse({ type: ChatSessionResponseDto })
  async getSession(
    @Param() params: SessionParamsDto,
  ): Promise<ChatSessionResponseDto> {
    const result = await this.chatService.getSessionById(params.id, {
      withTasks: true,
    });
    return this.mapSessionToResponse(result);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a chat session' })
  @ApiOkResponse({ type: ChatSessionResponseDto })
  async updateSession(
    @Param() params: SessionParamsDto,
    @Body() dto: UpdateSessionDto,
  ): Promise<ChatSessionResponseDto> {
    const result = await this.chatService.updateSession(params.id, {
      title: dto.title,
      project: dto.project,
      isArchived: dto.isArchived,
      isPinned: dto.isPinned,
    });
    return this.mapSessionToResponse(result);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a chat session' })
  async deleteSession(@Param() params: SessionParamsDto): Promise<void> {
    await this.chatService.deleteSession(params.id);
  }

  @Post(':id/messages')
  @ApiOperation({ summary: 'Send a message to the ADK agent (non-streaming)' })
  @ApiOkResponse({ type: SendMessageResponseDto })
  async sendMessage(
    @Param() params: SessionParamsDto,
    @Body() dto: ChatSendMessageDto,
  ): Promise<SendMessageResponseDto> {
    return await this.chatService.sendMessage(params.id, dto.message);
  }

  @Sse(':id/messages/stream')
  @ApiOperation({
    summary: 'Send a message to the ADK agent with streaming response',
  })
  async sendMessageStream(
    @Param() params: SessionParamsDto,
    @Body() dto: ChatSendMessageDto,
  ): Promise<Observable<MessageEvent>> {
    const generator = this.chatService.sendMessageStream(
      params.id,
      dto.message,
    );

    return new Observable((subscriber) => {
      (async () => {
        try {
          for await (const event of generator) {
            subscriber.next({
              data: JSON.stringify(event),
            } as MessageEvent);
          }
          subscriber.complete();
        } catch (error) {
          subscriber.error(error);
        }
      })();
    });
  }

  private mapSessionToResponse(result: SessionResult): ChatSessionResponseDto {
    const response: ChatSessionResponseDto = {
      id: result.id,
      adkSessionId: result.adkSessionId,
      agentId: result.agentId,
      title: result.title,
      project: result.project,
      isArchived: result.isArchived,
      isPinned: result.isPinned,
      lastMessageAt: result.lastMessageAt.toISOString(),
      rowVersion: result.rowVersion,
      createdAt: result.createdAt.toISOString(),
      updatedAt: result.updatedAt.toISOString(),
      deletedAt: result.deletedAt ? result.deletedAt.toISOString() : null,
    };

    if (result.referencedTasks) {
      response.referencedTasks = result.referencedTasks.map((task) =>
        this.mapTaskToResponse(task),
      );
    }

    if (result.subscribedTasks) {
      response.subscribedTasks = result.subscribedTasks.map((task) =>
        this.mapTaskToResponse(task),
      );
    }

    return response;
  }

  private mapTaskToResponse(task: TaskResult): TaskResponseDto {
    return {
      id: task.id,
      name: task.name,
      description: task.description,
      status: task.status,
      assignee: task.assignee,
    };
  }
}
