import { IsString, IsEnum, IsOptional, IsUUID } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ThreadMessageRole } from './service/threads.service.types';

export class CreateThreadMessageDto {
  @ApiProperty({
    description: 'Role of the message sender',
    enum: ThreadMessageRole,
    example: ThreadMessageRole.USER,
  })
  @IsEnum(ThreadMessageRole)
  role!: ThreadMessageRole;

  @ApiProperty({
    description: 'Content of the message',
    example: 'What is the status of this feature?',
  })
  @IsString()
  content!: string;

  @ApiPropertyOptional({
    description: 'Actor ID who created the message (optional for system messages)',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsUUID()
  @IsOptional()
  createdByActorId?: string;
}
