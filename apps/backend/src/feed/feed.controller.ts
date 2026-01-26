import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiOkResponse,
  ApiCookieAuth,
} from '@nestjs/swagger';
import { FeedService } from './feed.service';
import { ListFeedQueryDto } from './dto/list-feed-query.dto';
import { FeedListResponseDto } from './dto/feed-list-response.dto';
import { FeedItemResponseDto } from './dto/feed-item-response.dto';
import { FeedItemResult } from './dto/service/feed.service.types';
import { ActorResponseDto } from '../identity-provider/dto/actor-response.dto';
import { AccessTokenGuard } from '../auth/guards/guards/access-token.guard';
import { ScopesGuard } from '../auth/guards/guards/scopes.guard';
import { RequireScopes } from '../auth/guards/decorators/require-scopes.decorator';
import { TasksScopes } from '../tasks/tasks.scopes';

@ApiTags('Feed')
@ApiCookieAuth('JWT-Cookie')
@Controller('feed')
@UseGuards(AccessTokenGuard, ScopesGuard)
@RequireScopes(TasksScopes.READ.id)
export class FeedController {
  constructor(private readonly feedService: FeedService) {}

  @Get()
  @ApiOperation({
    summary: 'Get activity feed',
    description: 'Retrieve a timeline of events that have occurred in the system, optionally filtered by task',
  })
  @ApiOkResponse({
    type: FeedListResponseDto,
    description: 'Paginated list of feed items sorted by recency',
  })
  async listFeed(@Query() query: ListFeedQueryDto): Promise<FeedListResponseDto> {
    const result = await this.feedService.listFeed({
      taskId: query.taskId,
      page: query.page ?? 1,
      limit: query.limit ?? 50,
    });

    return {
      items: result.items.map((item) => this.mapResultToResponse(item)),
      total: result.total,
      page: result.page,
      limit: result.limit,
      totalPages: Math.ceil(result.total / result.limit),
    };
  }

  private mapResultToResponse(result: FeedItemResult): FeedItemResponseDto {
    return {
      id: result.id,
      eventType: result.eventType,
      taskId: result.taskId,
      taskName: result.taskName,
      actor: this.mapActorResultToResponse(result.actor),
      metadata: result.metadata,
      createdAt: result.createdAt.toISOString(),
    };
  }

  private mapActorResultToResponse(actor: any): ActorResponseDto {
    return {
      id: actor.id,
      type: actor.type,
      slug: actor.slug,
      displayName: actor.displayName,
      avatarUrl: actor.avatarUrl,
    };
  }
}
