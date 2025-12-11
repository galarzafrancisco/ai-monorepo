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
import { ListAppsResponseDto } from './dto/list-apps-response.dto';
import { AdkSessionResponseDto } from './dto/adk-session-response.dto';
import { AdkListSessionsResponseDto } from './dto/list-sessions-response.dto';
import { AdkSendMessageResponseDto } from './dto/adk-send-message-response.dto';

@ApiTags('ADK')
@Controller('adk')
export class AdkController {
  constructor(private readonly adkService: AdkService) {}

  @Get('apps')
  @ApiOperation({ summary: 'List all available ADK apps' })
  @ApiOkResponse({ type: ListAppsResponseDto })
  async listApps(): Promise<ListAppsResponseDto> {
    const apps = await this.adkService.listApps();
    return { apps };
  }

  @Post('sessions')
  @ApiOperation({ summary: 'Create a new ADK session' })
  @ApiCreatedResponse({ type: AdkSessionResponseDto })
  async createSession(
    @Body() dto: CreateAdkSessionDto,
  ): Promise<AdkSessionResponseDto> {
    return this.adkService.createSession(dto.appId, dto.userId, dto.sessionId);
  }

  @Get('apps/:appId/users/:userId/sessions')
  @ApiOperation({ summary: 'List sessions for an app and user' })
  @ApiOkResponse({ type: AdkListSessionsResponseDto })
  async listSessions(
    @Param('appId') appId: string,
    @Param('userId') userId: string,
  ): Promise<AdkListSessionsResponseDto> {
    const sessions = await this.adkService.listSessions(appId, userId);
    return { sessions };
  }

  @Get('apps/:appId/users/:userId/sessions/:sessionId')
  @ApiOperation({ summary: 'Get a specific session' })
  @ApiOkResponse({ type: AdkSessionResponseDto })
  async getSession(@Param() params: SessionParamsDto): Promise<AdkSessionResponseDto> {
    return this.adkService.getSession(
      params.appId,
      params.userId,
      params.sessionId,
    );
  }

  @Post('messages')
  @ApiOperation({ summary: 'Send a message to an ADK agent (non-streaming)' })
  @ApiOkResponse({ type: AdkSendMessageResponseDto })
  async sendMessage(@Body() dto: SendMessageDto): Promise<AdkSendMessageResponseDto> {
    const events = await this.adkService.run({
      app_name: dto.appId,
      user_id: dto.userId,
      session_id: dto.sessionId,
      new_message: {
        role: 'user',
        parts: [{ text: dto.message }],
      },
      streaming: false,
    });
    return { events };
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
