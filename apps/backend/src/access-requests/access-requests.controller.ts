import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiCookieAuth,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiTooManyRequestsResponse,
} from '@nestjs/swagger';
import { AccessTokenGuard } from '../auth/guards/guards/access-token.guard';
import { ScopesGuard } from '../auth/guards/guards/scopes.guard';
import { RequireScopes } from '../auth/guards/decorators/require-scopes.decorator';
import { CurrentUser } from '../auth/guards/decorators/current-user.decorator';
import type { UserContext } from '../auth/guards/context/auth-context.types';
import { UserScopes } from '../auth/core/scopes/user.scopes';
import { AccessRequestsService } from './access-requests.service';
import { AccessRequestResult } from './dto/service/access-requests.service.types';
import { CreateAccessRequestDto, CreateAccessRequestResponseDto } from './dto/http/create-access-request.dto';
import {
  AccessRequestListResponseDto,
  AccessRequestResponseDto,
  ListAccessRequestsQueryDto,
  UpdateAccessRequestDto,
} from './dto/http/access-request-admin.dto';

/** Public and write-only: no read, lookup or existence check is exposed. */
@ApiTags('Access Requests')
@Controller('access-requests')
export class AccessRequestsController {
  constructor(private readonly service: AccessRequestsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Public: express interest in Taico access (write-only)' })
  @ApiCreatedResponse({ type: CreateAccessRequestResponseDto })
  @ApiTooManyRequestsResponse({ description: 'Submission ceiling reached; try again later' })
  async create(@Body() dto: CreateAccessRequestDto): Promise<CreateAccessRequestResponseDto> {
    // Honeypot: answer exactly like a real submission, store nothing.
    if (dto.website && dto.website.trim() !== '') return { received: true };
    await this.service.submit({ email: dto.email, building: dto.building });
    return { received: true };
  }
}

/** Admin-only review. Authorization is enforced server side via the admin scope. */
@ApiTags('Access Requests Admin')
@ApiCookieAuth('JWT-Cookie')
@Controller('admin/access-requests')
@UseGuards(AccessTokenGuard, ScopesGuard)
@RequireScopes(UserScopes.ADMIN.id)
export class AccessRequestsAdminController {
  constructor(private readonly service: AccessRequestsService) {}

  @Get()
  @ApiOperation({ summary: 'Admin: list access requests, most recently submitted first' })
  @ApiOkResponse({ type: AccessRequestListResponseDto })
  async list(@Query() query: ListAccessRequestsQueryDto): Promise<AccessRequestListResponseDto> {
    const { items, total } = await this.service.list(query);
    return { items: items.map(toDto), total };
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Admin: mark an access request new or reviewed' })
  @ApiOkResponse({ type: AccessRequestResponseDto })
  async update(
    @CurrentUser() user: UserContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateAccessRequestDto,
  ): Promise<AccessRequestResponseDto> {
    return toDto(await this.service.setStatus(id, dto.status, user.actorId));
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Admin: delete an access request' })
  @ApiNoContentResponse()
  async remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    await this.service.remove(id);
  }
}

function toDto(r: AccessRequestResult): AccessRequestResponseDto {
  return {
    id: r.id,
    email: r.email,
    building: r.building,
    status: r.status,
    submissionCount: r.submissionCount,
    createdAt: r.createdAt.toISOString(),
    lastSubmittedAt: r.lastSubmittedAt.toISOString(),
    reviewedAt: r.reviewedAt ? r.reviewedAt.toISOString() : null,
  };
}
