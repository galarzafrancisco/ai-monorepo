import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AppendThreadStateDto {
  @ApiProperty({
    description: 'Content to append to the thread state',
    example: 'Additional progress notes',
  })
  @IsString()
  @IsNotEmpty()
  content!: string;
}
