import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateAdkSessionDto {
  @ApiProperty({ description: 'App ID' })
  @IsString()
  @IsNotEmpty()
  appId!: string;

  @ApiProperty({ description: 'User ID' })
  @IsString()
  @IsNotEmpty()
  userId!: string;

  @ApiProperty({ description: 'Optional session ID', required: false })
  @IsString()
  @IsOptional()
  sessionId?: string;
}
