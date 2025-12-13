import { ChatEvent } from './dto/adk.types';
import {
  ChatMessageEvent,
  ChatMessageContent,
  ChatMessagePart,
  FunctionCall,
  FunctionResponse,
  UsageMetadata,
} from '../chat/events/chat.events';

/**
 * Transforms ADK events to our internal chat event format
 */
export class AdkEventTransformer {
  /**
   * Transform a single ADK ChatEvent to our ChatMessageEvent format
   */
  static transformEvent(adkEvent: ChatEvent): ChatMessageEvent {
    return {
      id: adkEvent.id,
      timestamp: adkEvent.timestamp,
      author: adkEvent.author,
      content: this.transformContent(adkEvent.content),
      partial: adkEvent.partial,
      invocationId: adkEvent.invocationId,
      usageMetadata: adkEvent.usageMetadata
        ? this.transformUsageMetadata(adkEvent.usageMetadata)
        : undefined,
    };
  }

  /**
   * Transform an array of ADK ChatEvents to our ChatMessageEvent format
   */
  static transformEvents(adkEvents: ChatEvent[]): ChatMessageEvent[] {
    return adkEvents.map((event) => this.transformEvent(event));
  }

  private static transformContent(
    adkContent: ChatEvent['content'],
  ): ChatMessageContent {
    return {
      role: adkContent.role,
      parts: adkContent.parts.map((part) => this.transformPart(part)),
    };
  }

  private static transformPart(
    adkPart: ChatEvent['content']['parts'][0],
  ): ChatMessagePart {
    const part: ChatMessagePart = {};

    if (adkPart.text !== undefined) {
      part.text = adkPart.text;
    }

    if (adkPart.functionCall) {
      part.functionCall = this.transformFunctionCall(adkPart.functionCall);
    }

    if (adkPart.functionResponse) {
      part.functionResponse = this.transformFunctionResponse(
        adkPart.functionResponse,
      );
    }

    return part;
  }

  private static transformFunctionCall(
    adkFunctionCall: NonNullable<
      ChatEvent['content']['parts'][0]['functionCall']
    >,
  ): FunctionCall {
    return {
      id: adkFunctionCall.id,
      name: adkFunctionCall.name,
      args: adkFunctionCall.args,
    };
  }

  private static transformFunctionResponse(
    adkFunctionResponse: NonNullable<
      ChatEvent['content']['parts'][0]['functionResponse']
    >,
  ): FunctionResponse {
    return {
      id: adkFunctionResponse.id,
      name: adkFunctionResponse.name,
      response: {
        result: adkFunctionResponse.response.result,
      },
    };
  }

  private static transformUsageMetadata(
    adkUsageMetadata: NonNullable<ChatEvent['usageMetadata']>,
  ): UsageMetadata {
    return {
      promptTokenCount: adkUsageMetadata.promptTokenCount,
      candidatesTokenCount: adkUsageMetadata.candidatesTokenCount,
      totalTokenCount: adkUsageMetadata.totalTokenCount,
    };
  }
}
