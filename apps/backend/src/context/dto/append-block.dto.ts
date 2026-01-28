import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class AppendBlockDto {
  @ApiProperty({
    description: 'Markdown content to append to the existing block content',
    example: '\n## Additional details',
  })
  @IsString()
  @IsNotEmpty()
  content!: string;
}
