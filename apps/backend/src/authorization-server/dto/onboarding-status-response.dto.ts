import { ApiProperty } from '@nestjs/swagger';

export class OnboardingStatusResponseDto {
  @ApiProperty({
    description: 'Whether the system needs to be onboarded (no admin users exist)',
    example: true,
  })
  needsOnboarding!: boolean;
}
