import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class AppendPageDto {
  @ApiProperty({
    description: 'Markdown content to append to the existing page content',
    example: '\n## Additional details',
  })
  @IsString()
  @IsNotEmpty()
  content!: string;
}
