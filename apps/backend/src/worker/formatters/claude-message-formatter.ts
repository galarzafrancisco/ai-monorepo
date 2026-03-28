import {
  SDKAssistantMessage,
  SDKAuthStatusMessage,
  SDKMessage,
  SDKPartialAssistantMessage,
  SDKResultMessage,
  SDKSystemMessage,
  SDKToolProgressMessage,
  SDKUserMessage,
} from '@anthropic-ai/claude-agent-sdk';

export class ClaudeMessageFormatter {
  constructor(private readonly agentSlug?: string) {}

  format(message: SDKMessage): string | null {
    switch (message.type) {
      case 'assistant':
        return this.formatAssistant(message as SDKAssistantMessage);
      case 'user':
        return this.formatUser(message as SDKUserMessage);
      case 'result':
        return this.formatResult(message as SDKResultMessage);
      case 'system':
        return this.formatSystem(message as SDKSystemMessage);
      case 'stream_event':
        return this.formatStreamEvent(message as SDKPartialAssistantMessage);
      case 'tool_progress':
        return this.formatToolProgress(message as SDKToolProgressMessage);
      case 'auth_status':
        return this.formatAuthStatus(message as SDKAuthStatusMessage);
      default:
        return null;
    }
  }

  private formatAssistant(message: SDKAssistantMessage): string | null {
    const parts: string[] = [];
    const content = message.message?.content;
    if (!Array.isArray(content)) {
      return null;
    }

    const agentLabel = this.agentSlug ? `@${this.agentSlug}` : 'Assistant';
    for (const chunk of content) {
      if (chunk.type === 'tool_use') {
        parts.push(`🔧 ${agentLabel} Tool call: ${chunk.name}`);
      } else if (chunk.type === 'text') {
        parts.push(`💬 ${agentLabel}: ${chunk.text}`);
      }
    }

    return parts.length > 0 ? parts.join('\n') : null;
  }

  private formatUser(message: SDKUserMessage): string | null {
    const parts: string[] = [];
    const content = message.message?.content;
    if (!Array.isArray(content)) {
      return null;
    }

    for (const chunk of content) {
      if (chunk.type === 'text') {
        parts.push(`👤 User: ${chunk.text}`);
      }
    }

    return parts.length > 0 ? parts.join('\n') : null;
  }

  private formatResult(message: SDKResultMessage): string | null {
    const agentLabel = this.agentSlug ? `@${this.agentSlug}` : 'Assistant';
    if (message.subtype === 'success' && typeof message.result === 'string') {
      return [`--- ${agentLabel} turn complete ---`, message.result, '---------------------------'].join('\n');
    }
    return `✅ ${agentLabel} result received`;
  }

  private formatSystem(message: SDKSystemMessage): string | null {
    const agentLabel = this.agentSlug ? `@${this.agentSlug}` : 'Assistant';
    if (message.subtype === 'init') {
      return [
        `🧠 ${agentLabel} Claude initialized`,
        `- Permissions: ${message.permissionMode}`,
        `- Tools: ${message.tools.length}`,
        `- MCP Servers: ${message.mcp_servers.length}`,
      ].join('\n');
    }
    return null;
  }

  private formatStreamEvent(_: SDKPartialAssistantMessage): string | null {
    return null;
  }

  private formatToolProgress(_: SDKToolProgressMessage): string | null {
    return null;
  }

  private formatAuthStatus(_: SDKAuthStatusMessage): string | null {
    const agentLabel = this.agentSlug ? `@${this.agentSlug}` : 'Assistant';
    return `🔐 ${agentLabel} Auth status updated`;
  }
}
