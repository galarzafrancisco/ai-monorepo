import { ApiProperty } from '@nestjs/swagger';
import { OnboardingDisplayMode } from '../../identity-provider/enums';

export class UserWalkthroughStatusResponseDto {
  @ApiProperty({ example: true })
  workerConfigured!: boolean;

  @ApiProperty({ example: true })
  agentCreated!: boolean;

  @ApiProperty({ example: true })
  taskCreated!: boolean;

  @ApiProperty({ example: true })
  projectCreated!: boolean;

  @ApiProperty({ example: true })
  projectConfigured!: boolean;

  @ApiProperty({ example: true })
  contextBlockCreated!: boolean;

  @ApiProperty({ example: true })
  threadConfigured!: boolean;

  @ApiProperty({ example: true })
  taskWithProjectCreated!: boolean;

  @ApiProperty({
    enum: OnboardingDisplayMode,
    example: OnboardingDisplayMode.FULL_PAGE,
  })
  onboardingDisplayMode!: OnboardingDisplayMode;
}
