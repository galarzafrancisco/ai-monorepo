import { Body, Controller, Get, HttpCode, Param, Post, UseGuards } from '@nestjs/common';
import { ApiCookieAuth, ApiNotFoundResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AccessTokenGuard } from '../auth/guards/guards/access-token.guard';
import { ScopesGuard } from '../auth/guards/guards/scopes.guard';
import { RequireScopes } from '../auth/guards/decorators/require-scopes.decorator';
import { IssuesService } from './issues.service';
import { IssuesScopes } from './issues.scopes';
import { LookupIssuesDto } from './dto/http/lookup-issues.dto';
import { IssueParamsDto } from './dto/http/issue-params.dto';
import { IssueResponseDto } from './dto/http/issue-response.dto';
import { toIssueResponse } from './dto/http/issue.mapper';
import { IssueRefInvalidError } from './errors/issues.errors';
import { IssueRef, parseIssueRef } from './github/issue-ref';

@ApiTags('Issues')
@ApiCookieAuth('JWT-Cookie')
@Controller('issues')
@UseGuards(AccessTokenGuard, ScopesGuard)
export class IssuesController {
  constructor(private readonly issues: IssuesService) {}

  @Post('lookup')
  @HttpCode(200)
  @RequireScopes(IssuesScopes.READ.id)
  @ApiOperation({
    summary: 'Status of linked issues, in the order asked',
    description:
      'Issues Taico has never read are read from GitHub before answering. Stale ones are answered from the stored copy and refreshed in the background; the new state arrives as an issue.updated socket event. Issues on a host that is neither github.com nor a GitHub Enterprise Taico has a connection to are left out.',
  })
  @ApiOkResponse({ type: [IssueResponseDto] })
  async lookup(@Body() dto: LookupIssuesDto): Promise<IssueResponseDto[]> {
    const hosts = await this.issues.listEnterpriseHosts();
    const refs: IssueRef[] = [];
    for (const value of dto.refs) {
      const ref = parseIssueRef(value, hosts);
      if (ref) refs.push(ref);
      // An issue on a host Taico has no connection to is left out of the answer.
      else if (!parseIssueRef(value, 'any')) throw new IssueRefInvalidError(value);
    }
    return (await this.issues.lookup(refs)).map(toIssueResponse);
  }

  @Get(':id')
  @RequireScopes(IssuesScopes.READ.id)
  @ApiOperation({ summary: 'Stored status of one issue' })
  @ApiOkResponse({ type: IssueResponseDto })
  @ApiNotFoundResponse({ description: 'Issue not found' })
  async get(@Param() params: IssueParamsDto): Promise<IssueResponseDto> {
    return toIssueResponse(await this.issues.getById(params.id));
  }

  @Post(':id/refresh')
  @HttpCode(200)
  @RequireScopes(IssuesScopes.WRITE.id)
  @ApiOperation({ summary: 'Read the issue from GitHub now' })
  @ApiOkResponse({ type: IssueResponseDto })
  @ApiNotFoundResponse({ description: 'Issue not found' })
  async refresh(@Param() params: IssueParamsDto): Promise<IssueResponseDto> {
    return toIssueResponse(await this.issues.refresh(params.id));
  }
}
