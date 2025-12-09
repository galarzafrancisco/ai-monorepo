// ADK Chat API types based on the ADK specification
// These types mirror the Python ADK API structure

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

export interface ChatEvent {
  id: string;
  timestamp: number;
  author: string;
  content: ChatMessageContent;
  partial?: boolean;
  invocationId?: string;
  usageMetadata?: UsageMetadata;
  [key: string]: unknown;
}

export interface Session {
  id: string;
  appName: string;
  userId: string;
  state: Record<string, unknown>;
  events: ChatEvent[];
  lastUpdateTime: number;
}

export interface NewMessage {
  role: string;
  parts: ChatMessagePart[];
}

export interface SendMessageRequest {
  app_name: string;
  user_id: string;
  session_id: string;
  new_message: NewMessage;
}

export type ListAppsResponse = string[];
export type ListSessionsResponse = Session[];
export type CreateSessionResponse = Session;
export type GetSessionResponse = Session;
export type SendMessageResponse = ChatEvent[];
