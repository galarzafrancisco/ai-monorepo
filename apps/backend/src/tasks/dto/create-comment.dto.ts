import { IsString, IsNotEmpty, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateCommentDto {
  @ApiProperty({
    description: 'Content of the comment',
    example: 'Task completed successfully. All tests passing.',
  })
  @IsString()
  @IsNotEmpty()
  content!: string;
}
