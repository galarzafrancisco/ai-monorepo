import { AssistantMessage, Part } from "@opencode-ai/sdk";

export class OpencodeMessageFormatter {
  format(info: AssistantMessage, parts: Array<Part>): Array<string> {
    const messages: string[] = [];
    
    // Parse info
    if (info.error) {
      messages.push(`Error ${info.error.name}: ${info.error.data}`);
    }

    // Parse parts
    const partMessages = parts.map(part => {

      switch (part.type) {
        case 'text':
          return part.text;
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
    });

    return [...messages, ...partMessages];
  }
}
