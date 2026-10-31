import { QueryRunner } from 'typeorm';
import { BackfillAgentFollowUpPrompts1763300000001 } from './1763300000001-BackfillAgentFollowUpPrompts';
import {
  DEV_FOLLOW_UP_PROMPT,
  DEV_PROMPT,
  REVIEWER_FOLLOW_UP_PROMPT,
  REVIEWER_PROMPT,
} from '../app-init/prompts/prompts';
import { LEGACY_DEV_PROMPTS } from '../app-init/prompts/legacy-prompts';

type Stored = {
  id: string;
  slug: string;
  system_prompt: string;
  follow_up_prompt: string | null;
};

const agent = (slug: string, systemPrompt: string): Stored => ({
  id: `id-${slug}`,
  slug,
  system_prompt: systemPrompt,
  follow_up_prompt: null,
});

/** Applies the migration's queries to an in-memory list of agents. */
async function migrate(agents: Stored[]) {
  const query = jest.fn(async (sql: string, params?: string[]) => {
    if (sql.trim().startsWith('SELECT')) {
      return agents.filter((stored) => stored.follow_up_prompt === null);
    }
    const stored = agents.find(({ id }) => id === params?.[1]);
    if (stored) stored.follow_up_prompt = params?.[0] ?? null;
    return [];
  });

  await new BackfillAgentFollowUpPrompts1763300000001().up({
    query,
  } as unknown as QueryRunner);
}

describe('BackfillAgentFollowUpPrompts', () => {
  it('gives built-in agents their follow-up, even with a customised system prompt', async () => {
    const agents = [
      agent('claude-dev', 'You are a bespoke agent.'),
      agent('code-reviewer', REVIEWER_PROMPT),
    ];

    await migrate(agents);

    expect(agents.map((stored) => stored.follow_up_prompt)).toEqual([
      DEV_FOLLOW_UP_PROMPT,
      REVIEWER_FOLLOW_UP_PROMPT,
    ]);
  });

  it('recognises agents created from a template by their system prompt', async () => {
    const agents = [
      agent('my-dev', DEV_PROMPT),
      agent('my-old-dev', LEGACY_DEV_PROMPTS[0]),
    ];

    await migrate(agents);

    expect(agents.map((stored) => stored.follow_up_prompt)).toEqual([
      DEV_FOLLOW_UP_PROMPT,
      DEV_FOLLOW_UP_PROMPT,
    ]);
  });

  it('leaves edited, cleared and unrelated agents alone', async () => {
    const agents = [
      { ...agent('claude-dev', DEV_PROMPT), follow_up_prompt: 'My own checks' },
      { ...agent('developer', DEV_PROMPT), follow_up_prompt: '' },
      agent('custom-agent', 'You are a bespoke agent.'),
    ];

    await migrate(agents);

    expect(agents.map((stored) => stored.follow_up_prompt)).toEqual([
      'My own checks',
      '',
      null,
    ]);
  });
});
