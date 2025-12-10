/**
 * Chat Event Types for SSE Communication
 *
 * These types define the structure of events sent between frontend and backend
 * during a chat conversation via Server-Sent Events (SSE).
 */

/**
 * Base properties shared by all chat events
 */
interface BaseChatEvent {
  /**
   * Unique identifier for the event
   */
  id: string;

  /**
   * Unix timestamp (milliseconds) when the event was created
   */
  timestamp: number;

  /**
   * Role of the event author ('user' or 'assistant')
   */
  role: 'user' | 'assistant';
}

/**
 * Tool Call Event
 * Sent when the assistant invokes a tool/function
 */
export interface ToolCallEvent extends BaseChatEvent {
  type: 'tool_call';

  /**
   * Unique identifier for this tool invocation
   * Used to link the call with its response
   */
  invocationId: string;

  /**
   * Name of the tool being called
   */
  toolName: string;

  /**
   * Parameters passed to the tool (JSON object)
   */
  parameters: Record<string, unknown>;
}

/**
 * Tool Response Event
 * Sent when a tool returns its result
 */
export interface ToolResponseEvent extends BaseChatEvent {
  type: 'tool_response';

  /**
   * Unique identifier linking this response to the original tool call
   */
  invocationId: string;

  /**
   * Name of the tool that was called
   */
  toolName: string;

  /**
   * Response payload from the tool
   * Can be JSON object or plain text
   */
  payload: Record<string, unknown> | string;
}

/**
 * Message Event
 * Sent for text messages from user or assistant
 * Supports streaming with partial updates
 */
export interface MessageEvent extends BaseChatEvent {
  type: 'message';

  /**
   * Text content of the message
   */
  text: string;

  /**
   * Indicates if this is a partial message in a stream
   * - true: This is part of a streaming response, more text will follow
   * - false or undefined: This is the final, complete message
   *
   * When streaming, the frontend will receive multiple events with partial: true
   * containing incremental text updates, followed by a final event with partial: false
   * containing the complete message text.
   */
  partial?: boolean;
}

/**
 * Thought Event
 * Sent for internal reasoning/thinking from the assistant
 * Supports streaming with partial updates
 */
export interface ThoughtEvent extends BaseChatEvent {
  type: 'thought';

  /**
   * Text content of the thought
   */
  text: string;

  /**
   * Indicates if this is a partial thought in a stream
   * - true: This is part of a streaming response, more text will follow
   * - false or undefined: This is the final, complete thought
   *
   * When streaming, the frontend will receive multiple events with partial: true
   * containing incremental text updates, followed by a final event with partial: false
   * containing the complete thought text.
   */
  partial?: boolean;
}

/**
 * Union type representing any chat event that can be sent during a conversation
 */
export type ChatEvent =
  | ToolCallEvent
  | ToolResponseEvent
  | MessageEvent
  | ThoughtEvent;

/**
 * Frontend to Backend: Message sent from user to assistant
 */
export interface SendMessageRequest {
  /**
   * Text content of the user's message
   */
  text: string;
}

/**
 * Type guard to check if an event is a tool call
 */
export function isToolCallEvent(event: ChatEvent): event is ToolCallEvent {
  return event.type === 'tool_call';
}

/**
 * Type guard to check if an event is a tool response
 */
export function isToolResponseEvent(
  event: ChatEvent,
): event is ToolResponseEvent {
  return event.type === 'tool_response';
}

/**
 * Type guard to check if an event is a message
 */
export function isMessageEvent(event: ChatEvent): event is MessageEvent {
  return event.type === 'message';
}

/**
 * Type guard to check if an event is a thought
 */
export function isThoughtEvent(event: ChatEvent): event is ThoughtEvent {
  return event.type === 'thought';
}

/**
 * Type guard to check if an event supports streaming (has partial flag)
 */
export function isStreamableEvent(
  event: ChatEvent,
): event is MessageEvent | ThoughtEvent {
  return event.type === 'message' || event.type === 'thought';
}
