import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Sse,
  MessageEvent,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiOkResponse,
  ApiCreatedResponse,
} from '@nestjs/swagger';
import { Observable } from 'rxjs';
import { AdkService } from './adk.service';
import { CreateAdkSessionDto } from './dto/create-adk-session.dto';
import { SendMessageDto } from './dto/send-message.dto';
import { SessionParamsDto } from './dto/session-params.dto';
import {
  ChatEvent,
  CreateSessionResponse,
  GetSessionResponse,
  ListAppsResponse,
  ListSessionsResponse,
  SendMessageResponse,
} from './dto/adk.types';

@ApiTags('ADK')
@Controller('adk')
export class AdkController {
  constructor(private readonly adkService: AdkService) {}

  @Get('apps')
  @ApiOperation({ summary: 'List all available ADK apps' })
  @ApiOkResponse({ type: [String] })
  async listApps(): Promise<ListAppsResponse> {
    return this.adkService.listApps();
  }

  @Post('sessions')
  @ApiOperation({ summary: 'Create a new ADK session' })
  @ApiCreatedResponse()
  async createSession(
    @Body() dto: CreateAdkSessionDto,
  ): Promise<CreateSessionResponse> {
    return this.adkService.createSession(dto.appId, dto.userId, dto.sessionId);
  }

  @Get('apps/:appId/users/:userId/sessions')
  @ApiOperation({ summary: 'List sessions for an app and user' })
  @ApiOkResponse()
  async listSessions(
    @Param('appId') appId: string,
    @Param('userId') userId: string,
  ): Promise<ListSessionsResponse> {
    return this.adkService.listSessions(appId, userId);
  }

  @Get('apps/:appId/users/:userId/sessions/:sessionId')
  @ApiOperation({ summary: 'Get a specific session' })
  @ApiOkResponse()
  async getSession(@Param() params: SessionParamsDto): Promise<GetSessionResponse> {
    return this.adkService.getSession(
      params.appId,
      params.userId,
      params.sessionId,
    );
  }

  @Post('messages')
  @ApiOperation({ summary: 'Send a message to an ADK agent (non-streaming)' })
  @ApiOkResponse()
  async sendMessage(@Body() dto: SendMessageDto): Promise<SendMessageResponse> {
    return this.adkService.run({
      app_name: dto.appId,
      user_id: dto.userId,
      session_id: dto.sessionId,
      new_message: {
        role: 'user',
        parts: [{ text: dto.message }],
      },
      streaming: false,
    });
  }

  @Sse('messages/stream')
  @ApiOperation({
    summary: 'Send a message to an ADK agent with SSE streaming',
  })
  async sendMessageStream(
    @Body() dto: SendMessageDto,
  ): Promise<Observable<MessageEvent>> {
    return new Observable<MessageEvent>((observer) => {
      const generator = this.adkService.runSSE({
        app_name: dto.appId,
        user_id: dto.userId,
        session_id: dto.sessionId,
        new_message: {
          role: 'user',
          parts: [{ text: dto.message }],
        },
        streaming: true,
      });

      (async () => {
        try {
          for await (const event of generator) {
            observer.next({
              data: event,
            } as MessageEvent);
          }
          observer.complete();
        } catch (error) {
          observer.error(error);
        }
      })();
    });
  }
}
