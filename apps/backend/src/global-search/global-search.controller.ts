import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiOkResponse,
  ApiCookieAuth,
} from '@nestjs/swagger';
import { GlobalSearchService } from './global-search.service';
import { GlobalSearchQueryDto } from './dto/global-search-query.dto';
import { GlobalSearchResultDto } from './dto/global-search-result.dto';
import { AccessTokenGuard } from '../auth/guards/guards/access-token.guard';
import { ScopesGuard } from '../auth/guards/guards/scopes.guard';

@ApiTags('Search')
@ApiCookieAuth('JWT-Cookie')
@Controller('search')
@UseGuards(AccessTokenGuard, ScopesGuard)
export class GlobalSearchController {
  constructor(private readonly globalSearchService: GlobalSearchService) {}

  @Get('query')
  @ApiOperation({ summary: 'Global search across all resources' })
  @ApiOkResponse({
    type: [GlobalSearchResultDto],
    description: 'Search results sorted by relevance',
  })
  async search(
    @Query() query: GlobalSearchQueryDto,
  ): Promise<GlobalSearchResultDto[]> {
    const results = await this.globalSearchService.search({
      query: query.query,
      limit: query.limit,
      threshold: query.threshold,
    });

    return results.map((result) => ({
      id: result.id,
      type: result.type,
      title: result.title,
      score: result.score,
      url: result.url,
    }));
  }
}
