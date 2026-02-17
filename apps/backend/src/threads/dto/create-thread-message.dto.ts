import { IsString, IsOptional, IsUUID } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateThreadMessageDto {
  @ApiProperty({
    description: 'Content of the message',
    example: 'What is the status of this feature?',
  })
  @IsString()
  content!: string;

  @ApiPropertyOptional({
    description: 'Actor ID who created the message',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsUUID()
  @IsOptional()
  createdByActorId?: string;
}
