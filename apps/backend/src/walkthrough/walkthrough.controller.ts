import { Controller, Get, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import {
  ApiCookieAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { AccessTokenGuard } from '../auth/guards/guards/access-token.guard';
import { CurrentUser } from '../auth/guards/decorators/current-user.decorator';
import type { UserContext } from '../auth/guards/context/auth-context.types';
import { UserWalkthroughStatusResponseDto } from './dto/walkthrough-status-response.dto';
import { WalkthroughService } from './walkthrough.service';

@ApiTags('Walkthrough')
@ApiCookieAuth('JWT-Cookie')
@Controller('walkthrough')
@UseGuards(AccessTokenGuard)
export class WalkthroughController {
  constructor(private readonly walkthroughService: WalkthroughService) {}

  @Post('acknowledge')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Acknowledge walkthrough — transitions FULL_PAGE display mode to BANNER' })
  @ApiOkResponse({ description: 'Acknowledged' })
  async acknowledge(
    @CurrentUser() user: UserContext,
  ): Promise<{ ok: boolean }> {
    await this.walkthroughService.acknowledgeForActor(user.actorId);
    return { ok: true };
  }

  @Get('status')
  @ApiOperation({ summary: 'Get walkthrough status for the current user' })
  @ApiOkResponse({
    type: UserWalkthroughStatusResponseDto,
    description: 'Current walkthrough progress and display mode',
  })
  async getStatus(
    @CurrentUser() user: UserContext,
  ): Promise<UserWalkthroughStatusResponseDto> {
    const status = await this.walkthroughService.getStatusForActor(user.actorId);

    return {
      workerConfigured: status.workerConfigured,
      agentCreated: status.agentCreated,
      taskCreated: status.taskCreated,
      projectCreated: status.projectCreated,
      projectConfigured: status.projectConfigured,
      contextBlockCreated: status.contextBlockCreated,
      threadConfigured: status.threadConfigured,
      taskWithProjectCreated: status.taskWithProjectCreated,
      onboardingDisplayMode: status.onboardingDisplayMode,
    };
  }
}
