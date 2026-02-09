import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty } from 'class-validator';

export class AppendThreadStateDto {
  @ApiProperty({
    description: 'Content to append to the thread state',
    example: 'Additional information to add to the state.',
  })
  @IsString()
  @IsNotEmpty()
  content!: string;
}
