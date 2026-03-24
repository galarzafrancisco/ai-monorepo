import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiCookieAuth,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { AccessTokenGuard } from '../auth/guards/guards/access-token.guard';
import { ScopesGuard } from '../auth/guards/guards/scopes.guard';
import { RequireScopes } from '../auth/guards/decorators/require-scopes.decorator';
import { CurrentUser } from '../auth/guards/decorators/current-user.decorator';
import type { UserContext } from '../auth/guards/context/auth-context.types';
import { ChatProvidersService } from './chat-providers.service';
import { CreateChatProviderDto } from './dto/http/create-chat-provider.dto';
import { UpdateChatProviderDto } from './dto/http/update-chat-provider.dto';
import { ChatProviderResponseDto } from './dto/http/chat-provider-response.dto';
import { ChatProviderParamsDto } from './dto/http/chat-provider-params.dto';
import { SetActiveChatProviderDto } from './dto/http/set-active-chat-provider.dto';
import { ChatProviderResult } from './dto/service/chat-providers.service.types';
import { ChatProvidersScopes } from './chat-providers.scopes';

@ApiTags('Chat Providers')
@ApiCookieAuth('JWT-Cookie')
@Controller('chat-providers')
@UseGuards(AccessTokenGuard, ScopesGuard)
export class ChatProvidersController {
  constructor(private readonly chatProvidersService: ChatProvidersService) {}

  @Post()
  @RequireScopes(ChatProvidersScopes.WRITE.id)
  @ApiOperation({ summary: 'Create a new chat provider' })
  @ApiCreatedResponse({
    type: ChatProviderResponseDto,
    description: 'Chat provider created successfully',
  })
  async createChatProvider(@Body() dto: CreateChatProviderDto): Promise<ChatProviderResponseDto> {
    const result = await this.chatProvidersService.createChatProvider({
      name: dto.name,
      type: dto.type,
      secretId: dto.secretId,
    });
    return this.mapToResponse(result);
  }

  @Get()
  @RequireScopes(ChatProvidersScopes.READ.id)
  @ApiOperation({ summary: 'List all chat providers' })
  @ApiOkResponse({ type: [ChatProviderResponseDto], description: 'List of chat providers' })
  async listChatProviders(): Promise<ChatProviderResponseDto[]> {
    const results = await this.chatProvidersService.listChatProviders();
    return results.map((r) => this.mapToResponse(r));
  }

  @Get(':id')
  @RequireScopes(ChatProvidersScopes.READ.id)
  @ApiOperation({ summary: 'Get chat provider by ID' })
  @ApiOkResponse({ type: ChatProviderResponseDto, description: 'Chat provider details' })
  @ApiNotFoundResponse({ description: 'Chat provider not found' })
  async getChatProvider(@Param() params: ChatProviderParamsDto): Promise<ChatProviderResponseDto> {
    const result = await this.chatProvidersService.getChatProviderById(params.id);
    return this.mapToResponse(result);
  }

  @Patch(':id')
  @RequireScopes(ChatProvidersScopes.WRITE.id)
  @ApiOperation({ summary: 'Update a chat provider' })
  @ApiOkResponse({
    type: ChatProviderResponseDto,
    description: 'Chat provider updated successfully',
  })
  @ApiNotFoundResponse({ description: 'Chat provider not found' })
  async updateChatProvider(
    @Param() params: ChatProviderParamsDto,
    @Body() dto: UpdateChatProviderDto,
    @CurrentUser() user: UserContext,
  ): Promise<ChatProviderResponseDto> {
    const result = await this.chatProvidersService.updateChatProvider(params.id, {
      name: dto.name,
      secretId: dto.secretId,
      apiKey: dto.apiKey,
      createdByActorId: user.actorId,
    });
    return this.mapToResponse(result);
  }

  @Delete(':id')
  @HttpCode(204)
  @RequireScopes(ChatProvidersScopes.DELETE.id)
  @ApiOperation({ summary: 'Delete a chat provider' })
  @ApiNoContentResponse({ description: 'Chat provider deleted successfully' })
  @ApiNotFoundResponse({ description: 'Chat provider not found' })
  async deleteChatProvider(@Param() params: ChatProviderParamsDto): Promise<void> {
    await this.chatProvidersService.deleteChatProvider(params.id);
  }

  @Post('set-active')
  @RequireScopes(ChatProvidersScopes.CONFIGURE.id)
  @ApiOperation({ summary: 'Set the active chat provider' })
  @ApiOkResponse({
    type: ChatProviderResponseDto,
    description: 'Active chat provider set successfully',
  })
  @ApiNotFoundResponse({ description: 'Chat provider not found' })
  async setActiveChatProvider(
    @Body() dto: SetActiveChatProviderDto,
  ): Promise<ChatProviderResponseDto> {
    const result = await this.chatProvidersService.setActiveChatProvider({
      providerId: dto.providerId,
    });
    return this.mapToResponse(result);
  }

  private mapToResponse(result: ChatProviderResult): ChatProviderResponseDto {
    return {
      id: result.id,
      name: result.name,
      type: result.type,
      secretId: result.secretId,
      isActive: result.isActive,
      isConfigured: result.isConfigured,
      rowVersion: result.rowVersion,
      createdAt: result.createdAt.toISOString(),
      updatedAt: result.updatedAt.toISOString(),
    };
  }
}
