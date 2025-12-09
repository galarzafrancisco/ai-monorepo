import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class SessionParamsDto {
  @ApiProperty({ description: 'App ID' })
  @IsString()
  @IsNotEmpty()
  appId!: string;

  @ApiProperty({ description: 'User ID' })
  @IsString()
  @IsNotEmpty()
  userId!: string;

  @ApiProperty({ description: 'Session ID' })
  @IsString()
  @IsNotEmpty()
  sessionId!: string;
}
