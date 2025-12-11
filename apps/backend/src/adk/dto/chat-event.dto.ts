import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ChatMessagePartDto } from './chat-message-part.dto';

export class ChatMessageContentDto {
  @ApiProperty({
    description: 'Role of the message author (user, agent, system)',
    example: 'agent',
  })
  role!: string;

  @ApiProperty({
    description: 'Parts of the message content',
    type: [ChatMessagePartDto],
  })
  parts!: ChatMessagePartDto[];
}

export class UsageMetadataDto {
  @ApiProperty({
    description: 'Number of tokens in the prompt',
    example: 150,
  })
  promptTokenCount!: number;

  @ApiProperty({
    description: 'Number of tokens in the candidates',
    example: 200,
  })
  candidatesTokenCount!: number;

  @ApiProperty({
    description: 'Total token count',
    example: 350,
  })
  totalTokenCount!: number;
}

export class ChatEventDto {
  @ApiProperty({
    description: 'Unique identifier for the chat event',
    example: 'evt_123e4567',
  })
  id!: string;

  @ApiProperty({
    description: 'Unix timestamp when the event occurred',
    example: 1701234567890,
  })
  timestamp!: number;

  @ApiProperty({
    description: 'Author of the event (user ID or agent ID)',
    example: 'user-123',
  })
  author!: string;

  @ApiProperty({
    description: 'Content of the chat message',
    type: ChatMessageContentDto,
  })
  content!: ChatMessageContentDto;

  @ApiPropertyOptional({
    description: 'Whether this is a partial event (streaming)',
    example: false,
  })
  partial?: boolean;

  @ApiPropertyOptional({
    description: 'Invocation identifier for the chat turn',
    example: 'inv_123e4567',
  })
  invocationId?: string;

  @ApiPropertyOptional({
    description: 'Token usage metadata for the event',
    type: UsageMetadataDto,
  })
  usageMetadata?: UsageMetadataDto;
}
