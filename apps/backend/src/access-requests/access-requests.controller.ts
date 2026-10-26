import {
  Body, Controller, Delete, Get, HttpCode, HttpException, HttpStatus, Param, ParseUUIDPipe, Patch, Post, Query, Req, UseGuards,
} from '@nestjs/common';
import { ApiCookieAuth, ApiAcceptedResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { AccessTokenGuard } from '../auth/guards/guards/access-token.guard';
import { CurrentUser } from '../auth/guards/decorators/current-user.decorator';
import type { UserContext } from '../auth/guards/context/auth-context.types';
import { AccessRequestEntity } from './access-request.entity';
import { AccessRequestsService } from './access-requests.service';
import { RateLimiter } from './access-requests.rate-limiter';
import { CreateAccessRequestDto, CreateAccessRequestResponseDto } from './dto/create-access-request.dto';
import {
  AccessRequestListResponseDto, AccessRequestResponseDto, ListAccessRequestsQueryDto, UpdateAccessRequestDto,
} from './dto/access-request-admin.dto';

const toDto = (r: AccessRequestEntity): AccessRequestResponseDto => ({
  id: r.id,
  email: r.email,
  building: r.building,
  status: r.status,
  submissionCount: r.submissionCount,
  createdAt: r.createdAt.toISOString(),
  lastSubmittedAt: r.lastSubmittedAt.toISOString(),
  reviewedAt: r.reviewedAt ? r.reviewedAt.toISOString() : null,
});

/** Public, write-only. No read, lookup or existence check is exposed. */
@ApiTags('Access Requests')
@Controller('access-requests')
export class AccessRequestsController {
  // 5 per IP per hour, and a coarse global ceiling against distributed floods.
  private readonly perIp = new RateLimiter(5, 60 * 60 * 1000);
  private readonly global = new RateLimiter(300, 60 * 60 * 1000);

  constructor(private readonly service: AccessRequestsService) {}

  @Post()
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Public: express interest in access (write-only)' })
  @ApiAcceptedResponse({ type: CreateAccessRequestResponseDto })
  async create(@Body() dto: CreateAccessRequestDto, @Req() req: Request): Promise<CreateAccessRequestResponseDto> {
    const ip = req.ip ?? req.socket?.remoteAddress;
    if (!this.perIp.hit(ip ?? 'unknown') || !this.global.hit('all')) {
      throw new HttpException('Too many requests. Please try again later.', HttpStatus.TOO_MANY_REQUESTS);
    }
    // Honeypot: pretend success, store nothing.
    if (dto.website && dto.website.trim() !== '') return { received: true };
    await this.service.submit({
      email: dto.email,
      building: dto.building,
      ipHash: AccessRequestsService.hashIp(ip),
    });
    return { received: true };
  }
}

@ApiTags('Access Requests Admin')
@ApiCookieAuth('JWT-Cookie')
@Controller('admin/access-requests')
@UseGuards(AccessTokenGuard)
export class AccessRequestsAdminController {
  constructor(private readonly service: AccessRequestsService) {}

  @Get()
  @ApiOperation({ summary: 'Admin: list access requests, newest first' })
  @ApiOkResponse({ type: AccessRequestListResponseDto })
  async list(@CurrentUser() user: UserContext, @Query() q: ListAccessRequestsQueryDto): Promise<AccessRequestListResponseDto> {
    await this.service.assertAdmin(user.actorId);
    const { items, total } = await this.service.list(q);
    return { items: items.map(toDto), total };
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Admin: mark an access request new/reviewed' })
  @ApiOkResponse({ type: AccessRequestResponseDto })
  async update(
    @CurrentUser() user: UserContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateAccessRequestDto,
  ): Promise<AccessRequestResponseDto> {
    await this.service.assertAdmin(user.actorId);
    return toDto(await this.service.setStatus(id, dto.status, user.actorId));
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Admin: delete an access request (retention)' })
  async remove(@CurrentUser() user: UserContext, @Param('id', ParseUUIDPipe) id: string): Promise<void> {
    await this.service.assertAdmin(user.actorId);
    await this.service.remove(id);
  }
}
