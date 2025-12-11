import { ApiProperty } from '@nestjs/swagger';
import { ChatEventDto } from './chat-event.dto';

export class AdkSendMessageResponseDto {
  @ApiProperty({
    description: 'List of chat events generated from sending the message',
    type: [ChatEventDto],
  })
  events!: ChatEventDto[];
}
