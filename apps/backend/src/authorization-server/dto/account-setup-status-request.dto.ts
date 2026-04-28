import { ApiProperty } from '@nestjs/swagger';
import { IsEmail } from 'class-validator';

export class AccountSetupStatusRequestDto {
  @ApiProperty({ description: 'Email address to check', example: 'user@example.com' })
  @IsEmail()
  email!: string;
}
