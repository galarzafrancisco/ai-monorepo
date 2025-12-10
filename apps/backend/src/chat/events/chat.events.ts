import { SessionEntity } from '../session.entity';

export class SessionCreatedEvent {
  constructor(public readonly session: SessionEntity) {}
}

export class SessionUpdatedEvent {
  constructor(public readonly session: SessionEntity) {}
}

export class SessionDeletedEvent {
  constructor(public readonly sessionId: string) {}
}

export class TaskReferencedEvent {
  constructor(
    public readonly sessionId: string,
    public readonly taskId: string,
  ) {}
}

export class TaskSubscribedEvent {
  constructor(
    public readonly sessionId: string,
    public readonly taskId: string,
  ) {}
}

export class TaskUnsubscribedEvent {
  constructor(
    public readonly sessionId: string,
    public readonly taskId: string,
  ) {}
}

// Chat Message Events - represent chat interactions and agent responses

export interface FunctionCall {
  id: string;
  name: string;
  args: Record<string, unknown>;
}

export interface FunctionResponse {
  id: string;
  name: string;
  response: {
    result: string;
  };
}

export interface ChatMessagePart {
  text?: string;
  functionCall?: FunctionCall;
  functionResponse?: FunctionResponse;
}

export interface ChatMessageContent {
  role: string;
  parts: ChatMessagePart[];
}

export interface UsageMetadata {
  promptTokenCount: number;
  candidatesTokenCount: number;
  totalTokenCount: number;
}

export interface ChatMessageEvent {
  id: string;
  timestamp: number;
  author: string;
  content: ChatMessageContent;
  partial?: boolean;
  invocationId?: string;
  usageMetadata?: UsageMetadata;
}
