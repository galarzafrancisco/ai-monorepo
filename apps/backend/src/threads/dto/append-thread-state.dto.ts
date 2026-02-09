import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class AppendThreadStateDto {
  @ApiProperty({
    description: 'Content to append to the thread state',
    example: 'Added more detail about current execution status.',
  })
  @IsString()
  @IsNotEmpty()
  content!: string;
}
