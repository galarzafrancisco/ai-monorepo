import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateThreadStateDto {
  @ApiProperty({
    description: 'New content for the thread state',
    example: 'Updated thread state with current progress',
  })
  @IsString()
  @IsNotEmpty()
  content!: string;
}
