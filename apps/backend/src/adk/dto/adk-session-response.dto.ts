import { ApiProperty } from '@nestjs/swagger';
import { ChatEventDto } from './chat-event.dto';

export class AdkSessionResponseDto {
  @ApiProperty({
    description: 'Unique identifier for the session',
    example: 'session-123e4567',
  })
  id!: string;

  @ApiProperty({
    description: 'Name of the ADK app',
    example: 'buddy',
  })
  appName!: string;

  @ApiProperty({
    description: 'User ID associated with the session',
    example: 'user-123',
  })
  userId!: string;

  @ApiProperty({
    description: 'Session state data',
    example: { conversationContext: 'greeting' },
  })
  state!: Record<string, unknown>;

  @ApiProperty({
    description: 'List of chat events in the session',
    type: [ChatEventDto],
  })
  events!: ChatEventDto[];

  @ApiProperty({
    description: 'Unix timestamp of the last update to the session',
    example: 1701234567890,
  })
  lastUpdateTime!: number;
}
