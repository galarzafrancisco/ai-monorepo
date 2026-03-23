import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString, MinLength } from 'class-validator';

export class OnboardingRequestDto {
  @ApiProperty({
    description: 'Email address for the first admin user',
    example: 'admin@example.com',
  })
  @IsEmail()
  email!: string;

  @ApiProperty({
    description: 'Display name for the first admin user',
    example: 'Admin User',
  })
  @IsString()
  @IsNotEmpty()
  displayName!: string;

  @ApiProperty({
    description: 'Slug/username for the first admin user',
    example: 'admin',
  })
  @IsString()
  @IsNotEmpty()
  slug!: string;

  @ApiProperty({
    description: 'Password for the first admin user (minimum 8 characters)',
    example: 'securepassword123',
  })
  @IsString()
  @MinLength(8)
  password!: string;
}
