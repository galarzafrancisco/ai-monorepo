import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AppendThreadStateDto {
  @ApiProperty({
    description: 'Content to append to the thread state',
    example: '\nDecision: Using JWT for authentication.',
  })
  @IsString()
  @IsNotEmpty()
  content!: string;
}
