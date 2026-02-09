import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class UpdateThreadStateDto {
  @ApiProperty({
    description: 'New thread state content',
    example: 'Work in progress on task execution flow.',
  })
  @IsString()
  @IsNotEmpty()
  content!: string;
}
