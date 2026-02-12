import {
  SDKAssistantMessage,
  SDKAuthStatusMessage,
  SDKMessage,
  SDKPartialAssistantMessage,
  SDKResultMessage,
  SDKSystemMessage,
  SDKToolProgressMessage,
  SDKUserMessage,
} from "@anthropic-ai/claude-agent-sdk";

export class ClaudeMessageFormatter {
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

  // ---------------- private helpers ----------------

  private formatAssistant(message: SDKAssistantMessage): string | null {
    const parts: string[] = [];
    const content = message.message?.content;

    if (!Array.isArray(content)) return null;

    for (const c of content) {
      if (c.type === 'tool_use') {
        parts.push(`🔧 Tool call: ${c.name}`);
      } else if (c.type === 'text') {
        parts.push(`💬 Assistant: ${c.text}`);
      } else {
        parts.push(`💬 Assistant (${c.type})`);
      }
    }

    return parts.length ? parts.join('\n') : null;
  }

  private formatUser(message: SDKUserMessage): string | null {
    const parts: string[] = [];
    const content = message.message?.content;

    if (!Array.isArray(content)) return null;

    for (const c of content) {
      if (c.type === 'tool_result') {
        // skip or log if you want
        continue;
      } else if (c.type === 'text') {
        parts.push(`👤 User: ${c.text}`);
      } else {
        parts.push(`👤 User (${c.type})`);
      }
    }

    return parts.length ? parts.join('\n') : null;
  }

  private formatResult(message: SDKResultMessage): string | null {
    if (
      message.subtype === 'success' &&
      typeof message.result === 'string'
    ) {
      return [
        `--- Agent turn complete ---`,
        message.result,
        `---------------------------`,
      ].join('\n');
    }

    return `✅ Agent result received`;
  }

  private formatSystem(message: SDKSystemMessage): string | null {
    if (message.subtype === 'init') {
      return [
        `🧠 Claude initialized`,
        `- Permissions: ${message.permissionMode}`,
        `- Tools: ${message.tools.length}`,
        `- MCP Servers: ${message.mcp_servers.length}`,
        `- Slash commands: ${message.slash_commands.length}`,
        `- Skills: ${message.skills.length}`,
        `- Plugins: ${message.plugins.length}`,
        `- Agents: ${message.agents?.length || 0}`,
      ].join('\n');
    }

    return `⚙️ System message`;
  }

  private formatStreamEvent(_: SDKPartialAssistantMessage): string | null {
    // usually too noisy — ignore by default
    return null;
  }

  private formatToolProgress(_: SDKToolProgressMessage): string | null {
    // ignore for MVP
    return null;
  }

  private formatAuthStatus(_: SDKAuthStatusMessage): string | null {
    return `🔐 Auth status updated`;
  }
}
