import {
  Controller,
  Get,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiOkResponse,
  ApiCookieAuth,
} from '@nestjs/swagger';
import { ThreadsService } from './threads.service';
import { AccessTokenGuard } from '../auth/guards/guards/access-token.guard';

@ApiTags('Threads')
@ApiCookieAuth('JWT-Cookie')
@Controller('threads')
@UseGuards(AccessTokenGuard)
export class ThreadsController {
  constructor(private readonly threadsService: ThreadsService) {}

  @Get()
  @ApiOperation({
    summary: 'List threads (placeholder)',
  })
  @ApiOkResponse({
    description: 'Returns list of threads',
  })
  async listThreads(): Promise<{ items: any[] }> {
    return await this.threadsService.listThreads();
  }
}
