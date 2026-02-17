import { IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateThreadMessageDto {
  @ApiProperty({
    description: 'Content of the message',
    example: 'What is the status of this feature?',
  })
  @IsString()
  content!: string;
}
