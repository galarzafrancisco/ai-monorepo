import { IsNotEmpty, IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ChangePasswordRequestDto {
  @ApiProperty({
    description: 'Current password',
    example: 'currentPassword123',
  })
  @IsString()
  @IsNotEmpty()
  currentPassword!: string;

  @ApiProperty({
    description: 'New password (minimum 8 characters)',
    example: 'newPassword456',
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(2, { message: 'Password must be at least 2 characters long' })
  newPassword!: string;
}
