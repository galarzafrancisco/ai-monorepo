import { AssistantMessage, Part, Event } from "@opencode-ai/sdk";

export function opencodePartToText(part: Part, agentSlug?: string): string {
  const agentLabel = agentSlug ? `@${agentSlug}` : 'Assistant';

  switch (part.type) {
    case 'text':
      return `💬 ${agentLabel}: ${part.text}`;
    case 'subtask':
      return `💬 ${agentLabel}: Creating subtask: ${part.description}`;
    case 'reasoning':
      return `💬 ${agentLabel}: Thinking...`;
    case 'file':
      return `📂 ${agentLabel} File ${part.filename || ''}`;
    case 'tool':
      return `🔧 ${agentLabel} Tool call: ${part.tool}`;
    case 'step-start':
      return `💬 ${agentLabel}: Starting step`;
    case 'step-finish':
      return `💬 ${agentLabel}: Finish step: ${part.reason}`;
    case 'snapshot':
      return `📸 ${agentLabel} Snapshot: ${part.snapshot}`;
    case 'patch':
      return `🔧 ${agentLabel} Patching files: ${part.files}`;
    case 'agent':
      return `🤖 ${agentLabel} Agent: ${part.name}`;
    case 'retry':
      return `🔄 ${agentLabel} Retrying error due to error '${part.error.name}'. Attempt ${part.attempt}...`;
    case 'compaction':
      return `🚜 ${agentLabel} Compacting`;
  }
}

export class OpencodeAsyncMessageFormatter {
  constructor(private agentSlug?: string) {}

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
    const message = opencodePartToText(part, this.agentSlug);

    return message;
  }
}

export class OpencodeSyncMessageFormatter {
  constructor(private agentSlug?: string) {}

  format(info: AssistantMessage, parts: Array<Part>): Array<string> {
    const messages: string[] = [];
    const agentLabel = this.agentSlug ? `@${this.agentSlug}` : 'Assistant';

    // Parse info
    if (info.error) {
      messages.push(`❌ ${agentLabel} Error ${info.error.name}: ${JSON.stringify(info.error.data)}`);
    }

    // Parse parts
    const partMessages = parts.map(part => opencodePartToText(part, this.agentSlug));

    return [...messages, ...partMessages];
  }
}
