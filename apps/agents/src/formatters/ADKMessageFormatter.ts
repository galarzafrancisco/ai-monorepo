import { Event } from "@google/adk";

export class ADKMessageFormatter {
  format(message: Event): Array<string> {
    const content = message.content;
    if (!content) {
      return [];
    }
    const parts = content.parts;
    if (!parts) {
      return [];
    }
    const partMessages = parts.map(part => {
      // Think
      if (part.thought) {
        return `💬 Thinking...`;
      }
      // Tool call
      if (part.functionCall) {
        return `🔧 Tool call: ${part.functionCall.name}`;
      }
      // Tool response
      if (part.functionResponse) {
        return `🔧 Tool response: ${part.functionResponse.name}`;
      }
      // Text
      if (part.text) {
        return `💬 Assistant: ${part.text}`;
      }
      return null;
    }).filter(p => p != null);

    return partMessages;
  }
}