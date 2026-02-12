import { AssistantMessage, Part, Event } from "@opencode-ai/sdk";

export function opencodePartToText(part: Part): string {
  switch (part.type) {
    case 'text':
      return `💬 Assistant: ${part.text}`;
    case 'subtask':
      return `💬 Assistant: Creating subtask: ${part.description}`;
    case 'reasoning':
      return `💬 Assistant: Thinking...`;
    case 'file':
      return `📂 File ${part.filename || ''}`;
    case 'tool':
      return `🔧 Tool call: ${part.tool}`;
    case 'step-start':
      return `💬 Assistant: Starting step`;
    case 'step-finish':
      return `💬 Assistant: Finish step: ${part.reason}`;
    case 'snapshot':
      return `📸 Snapshot: ${part.snapshot}`;
    case 'patch':
      return `🔧 Patching files: ${part.files}`;
    case 'agent':
      return `🤖 Agent: ${part.name}`;
    case 'retry':
      return `🔄 Retrying error due to error '${part.error.name}'. Attempt ${part.attempt}...`;
    case 'compaction':
      return `🚜 Compacting`;
  }
}

export class OpencodeAsyncMessageFormatter {
  // Only listen to part update (this is where tool calls and messages happen)
  format(event: Event): string | null {
    if (event.type !== 'message.part.updated') {
      return null;
    }
    // Ignore deltas
    if (event.properties.delta) {
      return null;
    }

    // Parse part into text
    const part = event.properties.part;
    const message = opencodePartToText(part);

    return message;
  }
}

export class OpencodeSyncMessageFormatter {
  format(info: AssistantMessage, parts: Array<Part>): Array<string> {
    const messages: string[] = [];

    // Parse info
    if (info.error) {
      messages.push(`Error ${info.error.name}: ${JSON.stringify(info.error.data)}`);
    }

    // Parse parts
    const partMessages = parts.map(opencodePartToText);

    return [...messages, ...partMessages];
  }
}
