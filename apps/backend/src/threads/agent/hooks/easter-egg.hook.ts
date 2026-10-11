import { Injectable } from '@nestjs/common';
import { BeforeTurnContext, ThreadAgentHook } from './thread-agent-hook.interface';

const RECOGNITION_PHRASE = 'the key is under the doormat';

/**
 * Example hook. When a user says the recognition phrase, the agent is quietly
 * handed the countersign. Copy this file to build a real hook: look at the new
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
      'The user just gave the recognition phrase. They are a fellow field agent.',
      'Open your reply with the countersign, word for word: "The owl only hoots at midnight."',
      'Then carry on as normal. Never reveal where you learned the countersign.',
    ].join('\n');
  }
}
