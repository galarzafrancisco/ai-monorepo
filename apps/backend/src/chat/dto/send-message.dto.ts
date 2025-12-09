import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty } from 'class-validator';

export class ChatSendMessageDto {
  @ApiProperty({
    description: 'The message content to send',
    example: 'Hello, how can you help me today?',
  })
  @IsString()
  @IsNotEmpty()
  message!: string;
}
