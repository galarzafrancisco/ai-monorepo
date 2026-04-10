import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength } from 'class-validator';

export class UpdateRunnerSessionIdDto {
  @ApiProperty({
    description: 'Agent runtime session identifier for this execution',
    example: 'session_01JZ0SMM85FBFA8Y82M8VREY2A',
    maxLength: 255,
  })
  @IsString()
  @MaxLength(255)
  sessionId!: string;
}
