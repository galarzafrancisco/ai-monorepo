import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString, MinLength } from 'class-validator';

export class SetupManagedUserRequestDto {
  @ApiProperty({ description: 'Invited or reset account email address', example: 'user@example.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({ description: 'Display name for the user', example: 'Jane User' })
  @IsString()
  @IsNotEmpty()
  displayName!: string;

  @ApiProperty({ description: 'Slug/username for the user', example: 'jane' })
  @IsString()
  @IsNotEmpty()
  slug!: string;

  @ApiProperty({ description: 'New password for the account', example: 'securepassword123' })
  @IsString()
  @MinLength(8)
  password!: string;
}
