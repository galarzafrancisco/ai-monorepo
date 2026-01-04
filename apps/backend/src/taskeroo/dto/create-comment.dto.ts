import { IsString, IsNotEmpty, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateCommentDto {
  @ApiPropertyOptional({
    description: 'Name of the person or agent commenting (auto-populated from authenticated user if not provided)',
    example: 'AgentBeta',
  })
  @IsString()
  @IsOptional()
  commenterName?: string;

  @ApiProperty({
    description: 'Content of the comment',
    example: 'Task completed successfully. All tests passing.',
  })
  @IsString()
  @IsNotEmpty()
  content!: string;
}
