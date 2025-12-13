import { ApiProperty } from '@nestjs/swagger';
import type {
  ChatMessageEvent,
  ChatMessageContent,
  ChatMessagePart,
  FunctionCall,
  FunctionResponse,
  UsageMetadata,
} from '../events/chat.events';

export class FunctionCallDto implements FunctionCall {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  args!: Record<string, unknown>;
}

export class FunctionResponseDto implements FunctionResponse {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  response!: {
    result: string;
  };
}

export class ChatMessagePartDto implements ChatMessagePart {
  @ApiProperty({ required: false })
  text?: string;

  @ApiProperty({ type: FunctionCallDto, required: false })
  functionCall?: FunctionCallDto;

  @ApiProperty({ type: FunctionResponseDto, required: false })
  functionResponse?: FunctionResponseDto;
}

export class ChatMessageContentDto implements ChatMessageContent {
  @ApiProperty()
  role!: string;

  @ApiProperty({ type: [ChatMessagePartDto] })
  parts!: ChatMessagePartDto[];
}

export class UsageMetadataDto implements UsageMetadata {
  @ApiProperty()
  promptTokenCount!: number;

  @ApiProperty()
  candidatesTokenCount!: number;

  @ApiProperty()
  totalTokenCount!: number;
}

export class ChatMessageEventDto implements ChatMessageEvent {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  timestamp!: number;

  @ApiProperty()
  author!: string;

  @ApiProperty({ type: ChatMessageContentDto })
  content!: ChatMessageContentDto;

  @ApiProperty({ required: false })
  partial?: boolean;

  @ApiProperty({ required: false })
  invocationId?: string;

  @ApiProperty({ type: UsageMetadataDto, required: false })
  usageMetadata?: UsageMetadataDto;
}

export class SendMessageResponseDto {
  @ApiProperty({ type: [ChatMessageEventDto] })
  events!: ChatMessageEventDto[];
}
