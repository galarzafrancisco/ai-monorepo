import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString } from 'class-validator';

export class AccountSetupStatusRequestDto {
  @ApiProperty({ description: 'Email address to check', example: 'user@example.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({ description: 'The one-time setup code from the setup link' })
  @IsString()
  @IsNotEmpty()
  code!: string;
}
