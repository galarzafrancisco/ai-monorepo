import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty } from 'class-validator';

export class UpdateThreadStateDto {
  @ApiProperty({
    description: 'New content for the thread state',
    example: 'Updated thread state with new information.',
  })
  @IsString()
  @IsNotEmpty()
  content!: string;
}
