import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateCommentDto {
  @ApiProperty({
    description: 'Name of the person or agent commenting',
    example: 'AgentBeta',
  })
  @IsString()
  @IsNotEmpty()
  commenterName!: string;

  @ApiProperty({
    description: 'Content of the comment',
    example: 'Task completed successfully. All tests passing.',
  })
  @IsString()
  @IsNotEmpty()
  content!: string;
}
