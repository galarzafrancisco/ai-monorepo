import { QueryRunner } from 'typeorm';
import { SilentAgentFollowUpPrompts1763300000003 } from './1763300000003-SilentAgentFollowUpPrompts';
import {
  ASSISTANT_FOLLOW_UP_PROMPT,
  DEV_FOLLOW_UP_PROMPT,
  REVIEWER_FOLLOW_UP_PROMPT,
  SHIPPER_FOLLOW_UP_PROMPT,
} from '../app-init/prompts/prompts';
import {
  LEGACY_ASSISTANT_FOLLOW_UP_PROMPTS,
  LEGACY_DEV_FOLLOW_UP_PROMPTS,
  LEGACY_REVIEWER_FOLLOW_UP_PROMPTS,
  LEGACY_SHIPPER_FOLLOW_UP_PROMPTS,
} from '../app-init/prompts/legacy-prompts';

type Stored = { id: string; follow_up_prompt: string | null };

/** Applies the migration's queries to an in-memory list of agents. */
async function migrate(followUps: (string | null)[]) {
  const agents: Stored[] = followUps.map((follow_up_prompt, index) => ({
    id: `id-${index}`,
    follow_up_prompt,
  }));
  const query = jest.fn(async (sql: string, params?: string[]) => {
    if (sql.trim().startsWith('SELECT')) {
      return agents.filter((stored) => stored.follow_up_prompt !== null);
    }
    const stored = agents.find(({ id }) => id === params?.[1]);
    if (stored) stored.follow_up_prompt = params?.[0] ?? null;
    return [];
  });

  await new SilentAgentFollowUpPrompts1763300000003().up({
    query,
  } as unknown as QueryRunner);
  return agents.map((stored) => stored.follow_up_prompt);
}

describe('SilentAgentFollowUpPrompts', () => {
  it('moves every seeded follow-up to the current text of the same kind', async () => {
    const shipperVersions = LEGACY_SHIPPER_FOLLOW_UP_PROMPTS;

    expect(
      await migrate([
        ...LEGACY_DEV_FOLLOW_UP_PROMPTS,
        ...LEGACY_ASSISTANT_FOLLOW_UP_PROMPTS,
        ...LEGACY_REVIEWER_FOLLOW_UP_PROMPTS,
        ...shipperVersions,
      ]),
    ).toEqual([
      DEV_FOLLOW_UP_PROMPT,
      ASSISTANT_FOLLOW_UP_PROMPT,
      REVIEWER_FOLLOW_UP_PROMPT,
      ...shipperVersions.map(() => SHIPPER_FOLLOW_UP_PROMPT),
    ]);
  });

  it('ignores line endings and surrounding whitespace, as the prompt fields can change them', async () => {
    const stored = LEGACY_DEV_FOLLOW_UP_PROMPTS[0]
      .trim()
      .replace(/\n/g, '\r\n');

    expect(await migrate([stored])).toEqual([DEV_FOLLOW_UP_PROMPT]);
  });

  it('leaves edited, cleared and already current follow-ups alone', async () => {
    const followUps = [
      `${LEGACY_DEV_FOLLOW_UP_PROMPTS[0]}\nAlso run the linter.`,
      'My own checks',
      '',
      null,
      DEV_FOLLOW_UP_PROMPT,
    ];

    expect(await migrate(followUps)).toEqual(followUps);
  });
});
