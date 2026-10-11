import { Injectable, Logger } from '@nestjs/common';
import { generateText, ModelMessage } from 'ai';
import { getConfig } from 'src/config/env.config';
import { buildModelMessages } from '../agent-context.utils';
import { ThreadAgentLogService } from '../thread-agent-log.service';
import {
  ThreadAgentMessageKind,
  ThreadAgentMessageRole,
} from '../thread-agent.enums';
import { AfterTurnContext, ThreadAgentHook } from './thread-agent-hook.interface';

const MAX_PART_CHARS = 2_000;

const SUMMARY_INSTRUCTIONS = `You compress a conversation between users and an AI agent so the agent can continue it with less context.

Write a summary that keeps:
- what the users asked for and what is still open
- decisions, constraints and preferences that were stated
- ids and names of tasks, threads, context blocks and tags that were mentioned or changed
- what the agent already did, including the outcome of tool calls

Leave out pleasantries and anything already superseded. Write plain text, no preamble.`;

function clip(text: string): string {
  return text.length > MAX_PART_CHARS ? `${text.slice(0, MAX_PART_CHARS)}…` : text;
}

/** Plain-text rendering, so the summarizer needs no tool definitions to read tool calls. */
export function renderTranscript(messages: ModelMessage[]): string {
  const lines: string[] = [];

  for (const message of messages) {
    if (typeof message.content === 'string') {
      lines.push(`${message.role}: ${clip(message.content)}`);
      continue;
    }

    for (const part of message.content) {
      switch (part.type) {
        case 'text':
          lines.push(`${message.role}: ${clip(part.text)}`);
          break;
        case 'tool-call':
          lines.push(`assistant called ${part.toolName}: ${clip(JSON.stringify(part.input))}`);
          break;
        case 'tool-result':
          lines.push(`${part.toolName} returned: ${clip(JSON.stringify(part.output))}`);
          break;
      }
    }
  }

  return lines.join('\n');
}

/**
 * When the conversation grows past the configured size, appends a summary to
 * the agent log. Context loading stops at the newest summary, so later turns
 * send the summary instead of everything before it. Nothing is deleted.
 */
@Injectable()
export class CompactionHook implements ThreadAgentHook {
  readonly name = 'compaction';
  private readonly logger = new Logger(CompactionHook.name);

  constructor(private readonly agentLog: ThreadAgentLogService) {}

  async afterTurn(context: AfterTurnContext): Promise<void> {
    const threshold = getConfig().threadAgentCompactionTokenThreshold;
    if (context.lastInputTokens === null || context.lastInputTokens < threshold) {
      return;
    }

    const rows = await this.agentLog.loadContext(context.threadId);
    const transcript = renderTranscript(buildModelMessages(rows, context.model));
    if (!transcript) {
      return;
    }

    const result = await generateText({
      model: context.model.model,
      instructions: SUMMARY_INSTRUCTIONS,
      prompt: transcript,
      providerOptions: context.model.providerOptions,
    });

    const summary = result.text.trim();
    if (!summary) {
      return;
    }

    await this.agentLog.append(context.threadId, [
      {
        role: ThreadAgentMessageRole.USER,
        kind: ThreadAgentMessageKind.SUMMARY,
        source: this.name,
        turnId: context.turnId,
        message: {
          role: 'user',
          content: `<conversation-summary>\n${summary}\n</conversation-summary>`,
        },
      },
    ]);

    this.logger.log({
      message: 'Compacted thread conversation',
      threadId: context.threadId,
      inputTokens: context.lastInputTokens,
      summarizedMessages: rows.length,
    });
  }
}
