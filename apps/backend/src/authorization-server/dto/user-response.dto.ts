import { ApiProperty } from '@nestjs/swagger';
import { OnboardingDisplayMode } from 'src/identity-provider/enums';

export class UserResponseDto {
  @ApiProperty({
    description: 'User ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  id!: string;

  @ApiProperty({
    description: 'User email address',
    example: 'user@example.com',
  })
  email!: string;

  @ApiProperty({
    description: 'User display name',
    example: 'John Doe',
  })
  displayName!: string;

  @ApiProperty({
    description: 'User role',
    enum: ['admin', 'standard'],
    example: 'standard',
  })
  role!: 'admin' | 'standard';

  @ApiProperty({
    description: 'Actor ID associated with this user',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  actorId!: string;

  @ApiProperty({
    description:
      'How onboarding UI should be shown for this user (full page, banner, or off)',
    enum: OnboardingDisplayMode,
    example: OnboardingDisplayMode.FULL_PAGE,
  })
  onboardingDisplayMode!: OnboardingDisplayMode;
}
