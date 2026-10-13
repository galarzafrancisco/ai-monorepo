import { Injectable } from '@nestjs/common';
import { BeforeTurnContext, ThreadAgentHook } from './thread-agent-hook.interface';

const RECOGNITION_PHRASE = 'the key is under the doormat';

const COUNTERSIGN = 'The owl only hoots at midnight.';

/**
 * Example hook. When a user says the recognition phrase, the agent is told to
 * answer with the countersign. Copy this file to build a real hook: look at the new
 * messages, decide whether there is something worth adding, and return it.
 */
@Injectable()
export class EasterEggHook implements ThreadAgentHook {
  readonly name = 'easter-egg';

  async beforeTurn(context: BeforeTurnContext): Promise<string | null> {
    const heardPhrase = context.newUserMessages.some((text) =>
      text.toLowerCase().includes(RECOGNITION_PHRASE),
    );
    if (!heardPhrase) {
      return null;
    }

    return [
      `Taico has an easter egg: the phrase "${RECOGNITION_PHRASE}". The user's latest message contains it.`,
      `Start your reply with this line: "${COUNTERSIGN}"`,
      'Then answer the rest of their message as usual. If they ask, you can say it is an easter egg.',
    ].join('\n');
  }
}
