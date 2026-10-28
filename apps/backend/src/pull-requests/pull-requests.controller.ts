import { Body, Controller, Get, HttpCode, Param, Post, UseGuards } from '@nestjs/common';
import { ApiCookieAuth, ApiNotFoundResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AccessTokenGuard } from '../auth/guards/guards/access-token.guard';
import { ScopesGuard } from '../auth/guards/guards/scopes.guard';
import { RequireScopes } from '../auth/guards/decorators/require-scopes.decorator';
import { PullRequestsService } from './pull-requests.service';
import { PullRequestsScopes } from './pull-requests.scopes';
import { LookupPullRequestsDto } from './dto/http/lookup-pull-requests.dto';
import { PullRequestParamsDto } from './dto/http/pull-request-params.dto';
import { PullRequestResponseDto } from './dto/http/pull-request-response.dto';
import { toPullRequestResponse } from './dto/http/pull-request.mapper';
import { parsePullRequestRef } from './github/pull-request-ref';
import { PullRequestRefInvalidError } from './errors/pull-requests.errors';

@ApiTags('Pull requests')
@ApiCookieAuth('JWT-Cookie')
@Controller('pull-requests')
@UseGuards(AccessTokenGuard, ScopesGuard)
export class PullRequestsController {
  constructor(private readonly pullRequests: PullRequestsService) {}

  @Post('lookup')
  @HttpCode(200)
  @RequireScopes(PullRequestsScopes.READ.id)
  @ApiOperation({
    summary: 'Status of linked pull requests, in the order asked',
    description:
      'Pull requests Taico has never read are read from GitHub before answering. Stale ones are answered from the stored copy and refreshed in the background; the new state arrives as a pull_request.updated socket event.',
  })
  @ApiOkResponse({ type: [PullRequestResponseDto] })
  async lookup(@Body() dto: LookupPullRequestsDto): Promise<PullRequestResponseDto[]> {
    const refs = dto.refs.map((value) => {
      const ref = parsePullRequestRef(value);
      if (!ref) throw new PullRequestRefInvalidError(value);
      return ref;
    });
    return (await this.pullRequests.lookup(refs)).map(toPullRequestResponse);
  }

  @Get(':id')
  @RequireScopes(PullRequestsScopes.READ.id)
  @ApiOperation({ summary: 'Stored status of one pull request' })
  @ApiOkResponse({ type: PullRequestResponseDto })
  @ApiNotFoundResponse({ description: 'Pull request not found' })
  async get(@Param() params: PullRequestParamsDto): Promise<PullRequestResponseDto> {
    return toPullRequestResponse(await this.pullRequests.getById(params.id));
  }

  @Post(':id/refresh')
  @HttpCode(200)
  @RequireScopes(PullRequestsScopes.WRITE.id)
  @ApiOperation({ summary: 'Read the pull request from GitHub now' })
  @ApiOkResponse({ type: PullRequestResponseDto })
  @ApiNotFoundResponse({ description: 'Pull request not found' })
  async refresh(@Param() params: PullRequestParamsDto): Promise<PullRequestResponseDto> {
    return toPullRequestResponse(await this.pullRequests.refresh(params.id));
  }
}
