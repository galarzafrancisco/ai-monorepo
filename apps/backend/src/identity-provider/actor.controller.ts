import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiOkResponse,
  ApiCookieAuth,
} from '@nestjs/swagger';
import { ActorService } from './actor.service';
import { ActorResponseDto } from './dto/actor-response.dto';
import { SearchActorsQueryDto } from './dto/search-actors-query.dto';
import { AccessTokenGuard } from '../auth/guards/guards/access-token.guard';

@ApiTags('Actors')
@ApiCookieAuth('JWT-Cookie')
@Controller('actors')
@UseGuards(AccessTokenGuard)
export class ActorController {
  constructor(private readonly actorService: ActorService) {}

  @Get()
  @ApiOperation({ summary: 'List all actors (users and agents)' })
  @ApiOkResponse({
    type: [ActorResponseDto],
    description: 'List of all actors',
  })
  async listActors(): Promise<ActorResponseDto[]> {
    const actors = await this.actorService.listActors();
    return actors.map((actor) => ({
      id: actor.id,
      type: actor.type,
      slug: actor.slug,
      displayName: actor.displayName,
      avatarUrl: actor.avatarUrl,
      introduction: actor.introduction,
    }));
  }

  @Get('search')
  @ApiOperation({ summary: 'Search actors by display name or slug' })
  @ApiOkResponse({
    type: [ActorResponseDto],
    description: 'Search results sorted by relevance',
  })
  async searchActors(
    @Query() query: SearchActorsQueryDto,
  ): Promise<ActorResponseDto[]> {
    const results = await this.actorService.searchActors({
      query: query.query,
      limit: query.limit,
      threshold: query.threshold,
    });

    return results.map(({ item: actor }) => ({
      id: actor.id,
      type: actor.type,
      slug: actor.slug,
      displayName: actor.displayName,
      avatarUrl: actor.avatarUrl,
      introduction: actor.introduction,
    }));
  }
}
