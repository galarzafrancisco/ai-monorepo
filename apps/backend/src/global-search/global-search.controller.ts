import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiOkResponse,
  ApiCookieAuth,
} from '@nestjs/swagger';
import { CurrentWorkspace } from '../auth/guards/decorators/current-workspace.decorator';
import { GlobalSearchService } from './global-search.service';
import { GlobalSearchQueryDto } from './dto/global-search-query.dto';
import { GlobalSearchResultDto } from './dto/global-search-result.dto';
import { AccessTokenGuard } from '../auth/guards/guards/access-token.guard';
import { ScopesGuard } from '../auth/guards/guards/scopes.guard';
import { WorkspaceAccess } from '../auth/guards/decorators/workspace-access.decorator';

@ApiTags('Search')
@ApiCookieAuth('JWT-Cookie')
@WorkspaceAccess('scoped')
@Controller('search')
@UseGuards(AccessTokenGuard, ScopesGuard)
export class GlobalSearchController {
  constructor(private readonly globalSearchService: GlobalSearchService) {}

  @Get('query')
  @ApiOperation({
    summary: 'Global search across all resources',
    description:
      'Searches tasks (including their comments), context blocks, tools, agents and projects by keyword, fuzzy title and meaning, and returns one list ranked by relevance.',
  })
  @ApiOkResponse({
    type: [GlobalSearchResultDto],
    description: 'Search results sorted by relevance',
  })
  async search(
    @Query() query: GlobalSearchQueryDto,
    @CurrentWorkspace() workspaceId: string,
  ): Promise<GlobalSearchResultDto[]> {
    const results = await this.globalSearchService.search(workspaceId, {
      query: query.query,
      limit: query.limit,
      types: query.types,
    });

    return results.map((result) => ({
      id: result.id,
      type: result.type,
      title: result.title,
      score: result.score,
      url: result.url,
      matchedBy: result.matchedBy,
      matchedOn: result.matchedOn,
      excerpt: result.excerpt,
      excerptIsComplete: result.excerptIsComplete,
      commentId: result.commentId,
      commentAuthor: result.commentAuthor,
    }));
  }
}
