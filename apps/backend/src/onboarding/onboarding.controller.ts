import { Controller, Get, UseGuards } from '@nestjs/common';
import {
  ApiCookieAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { AccessTokenGuard } from '../auth/guards/guards/access-token.guard';
import { CurrentUser } from '../auth/guards/decorators/current-user.decorator';
import type { UserContext } from '../auth/guards/context/auth-context.types';
import { UserOnboardingStatusResponseDto } from './dto/onboarding-status-response.dto';
import { OnboardingService } from './onboarding.service';

@ApiTags('Onboarding')
@ApiCookieAuth('JWT-Cookie')
@Controller('onboarding')
@UseGuards(AccessTokenGuard)
export class OnboardingController {
  constructor(private readonly onboardingService: OnboardingService) {}

  @Get('status')
  @ApiOperation({ summary: 'Get onboarding status for the current user' })
  @ApiOkResponse({
    type: UserOnboardingStatusResponseDto,
    description: 'Current onboarding progress and display mode',
  })
  async getStatus(
    @CurrentUser() user: UserContext,
  ): Promise<UserOnboardingStatusResponseDto> {
    const status = await this.onboardingService.getStatusForActor(user.actorId);

    return {
      workerConfigured: status.workerConfigured,
      agentCreated: status.agentCreated,
      taskCreated: status.taskCreated,
      projectCreated: status.projectCreated,
      contextBlockCreated: status.contextBlockCreated,
      threadConfigured: status.threadConfigured,
      taskWithProjectCreated: status.taskWithProjectCreated,
      onboardingDisplayMode: status.onboardingDisplayMode,
    };
  }
}
