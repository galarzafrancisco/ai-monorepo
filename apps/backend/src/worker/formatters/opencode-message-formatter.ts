import type { Event, Part } from '@opencode-ai/sdk';

function opencodePartToText(part: Part, agentSlug?: string): string | null {
  const agentLabel = agentSlug ? `@${agentSlug}` : 'Assistant';

  switch (part.type) {
    case 'text':
      return `💬 ${agentLabel}: ${part.text}`;
    case 'subtask':
      return `💬 ${agentLabel}: Creating subtask: ${part.description}`;
    case 'reasoning':
      return `💬 ${agentLabel}: Thinking...`;
    case 'file':
      return `📂 ${agentLabel} File ${part.filename ?? ''}`;
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
      return `🔄 ${agentLabel} Retrying due to '${part.error.name}' (attempt ${part.attempt})`;
    case 'compaction':
      return `🚜 ${agentLabel} Compacting`;
    default:
      return null;
  }
}

export class OpencodeAsyncMessageFormatter {
  constructor(private readonly agentSlug?: string) {}

  format(event: Event): string | null {
    if (event.type !== 'message.part.updated') {
      return null;
    }

    if (event.properties.delta) {
      return null;
    }

    return opencodePartToText(event.properties.part, this.agentSlug);
  }
}
