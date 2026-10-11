import { Injectable } from '@nestjs/common';
import { MetaService } from 'src/meta/meta.service';
import { BeforeTurnContext, ThreadAgentHook } from './thread-agent-hook.interface';

const MAX_TAGS = 200;

/**
 * When the user talks about tags, gives the agent the list of existing tags up
 * front so it does not have to spend a tool call (and context) to look them up.
 */
@Injectable()
export class TagsContextHook implements ThreadAgentHook {
  readonly name = 'tags';

  constructor(private readonly metaService: MetaService) {}

  async beforeTurn(context: BeforeTurnContext): Promise<string | null> {
    const mentionsTags = context.newUserMessages.some((text) => /\btag(s|ged|ging)?\b/i.test(text));
    if (!mentionsTags) {
      return null;
    }

    // The list is still in context from an earlier turn.
    if (context.context.some((row) => row.source === `hook:${this.name}`)) {
      return null;
    }

    const tags = await this.metaService.getAllTags();
    if (tags.length === 0) {
      return 'There are no tags yet.';
    }

    const names = tags.slice(0, MAX_TAGS).map((tag) => `- ${tag.name}`);
    return `Existing tags:\n${names.join('\n')}`;
  }
}
