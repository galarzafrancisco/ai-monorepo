import { Controller, Get, UseGuards } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiOkResponse,
  ApiCookieAuth,
} from '@nestjs/swagger';
import { ActorService } from './actor.service';
import { ActorResponseDto } from './dto/actor-response.dto';
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
    }));
  }
}
