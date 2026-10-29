// The runner's other collaborators pull in ESM-only dependencies; these tests
// only exercise agent seeding, so stub them out.
jest.mock('src/config/env.config', () => ({
  getConfig: () => ({ nodeEnv: 'test' }),
}));
jest.mock('src/context/context.service', () => ({ ContextService: class {} }));
jest.mock('src/meta/meta.service', () => ({ MetaService: class {} }));
jest.mock('src/ai-providers/ai-providers.service', () => ({
  AiProvidersService: class {},
}));
jest.mock('src/mcp-registry/mcp-registry.service', () => ({
  McpRegistryService: class {},
}));
jest.mock('src/identity-provider/identity-provider.service', () => ({
  IdentityProviderService: class {},
}));
jest.mock('src/agents/agents.service', () => ({ AgentsService: class {} }));
jest.mock('src/identity-provider/actor.service', () => ({
  ActorService: class {},
}));

import { AppInitRunner } from './app-init.runner';
import { AgentsService } from 'src/agents/agents.service';
import { ActorService } from 'src/identity-provider/actor.service';
import { createClaudeDev } from './agent/claude-dev.agent';
import { createDeveloper } from './agent/developer.agent';
import { createCodexDev } from './agent/codex-dev.agent';
import { createGrokDev } from './agent/grok-dev.agent';
import { AgentNotFoundError } from 'src/agents/errors/agents.errors';
import { DEV_PROMPT, ASSISTANT_PROMPT, TAICO_PROMPT } from './prompts/prompts';
import {
  LEGACY_ASSISTANT_PROMPTS,
  LEGACY_DEV_PROMPTS,
} from './prompts/legacy-prompts';

/**
 * Existing installations keep the prompt their built-in agents were seeded
 * with. These tests pin down how a restart moves them to the current prompt.
 */
describe('AppInitRunner seeded prompt sync', () => {
  const DEV_SLUGS = [
    createClaudeDev.slug,
    createDeveloper.slug,
    createCodexDev.slug,
    createGrokDev.slug,
  ];

  function buildRunner(stored: Record<string, string>) {
    const agentsService = {
      getAgentBySlug: jest.fn(({ slug }: { slug: string }) =>
        slug in stored
          ? Promise.resolve({
              actorId: `actor-${slug}`,
              slug,
              systemPrompt: stored[slug],
            })
          : Promise.reject(new AgentNotFoundError(slug)),
      ),
      createAgent: jest.fn((input: { slug: string; systemPrompt: string }) =>
        Promise.resolve({ actorId: `actor-${input.slug}`, ...input }),
      ),
      patchAgent: jest.fn<Promise<void>, [string, unknown]>(() =>
        Promise.resolve(),
      ),
    };
    const actorService = {
      hasDeletedActorForSlug: jest.fn(() => Promise.resolve(true)),
    };
    const unused = {} as never;
    const runner = new AppInitRunner(
      agentsService as unknown as AgentsService,
      actorService as unknown as ActorService,
      unused,
      unused,
      unused,
      unused,
      unused,
      unused,
      unused,
      unused,
    );
    return { runner, agentsService };
  }

  function patchedSlugs(agentsService: { patchAgent: jest.Mock }) {
    return agentsService.patchAgent.mock.calls.map(([actorId]) =>
      String(actorId).replace(/^actor-/, ''),
    );
  }

  it('moves unedited developer agents from the previous seeded prompt to the current one', async () => {
    const stored = Object.fromEntries(
      DEV_SLUGS.map((slug) => [slug, LEGACY_DEV_PROMPTS[0]]),
    );
    const { runner, agentsService } = buildRunner({
      ...stored,
      taico: TAICO_PROMPT,
    });

    await runner.ensureAgents();

    expect(patchedSlugs(agentsService).sort()).toEqual([...DEV_SLUGS].sort());
    for (const call of agentsService.patchAgent.mock.calls) {
      expect(call[1]).toEqual({ systemPrompt: DEV_PROMPT });
    }
  });

  it('moves an unedited gemini assistant to the current assistant prompt', async () => {
    const { runner, agentsService } = buildRunner({
      taico: TAICO_PROMPT,
      'gemini-assistant': LEGACY_ASSISTANT_PROMPTS[0],
    });

    await runner.ensureAgents();

    expect(agentsService.patchAgent).toHaveBeenCalledWith(
      'actor-gemini-assistant',
      { systemPrompt: ASSISTANT_PROMPT },
    );
  });

  it('leaves customised prompts alone', async () => {
    const custom = `${LEGACY_DEV_PROMPTS[0]}\nAlways write tests first.`;
    const { runner, agentsService } = buildRunner({
      taico: TAICO_PROMPT,
      'claude-dev': custom,
      [createCodexDev.slug]: 'You are a bespoke agent.',
    });

    await runner.ensureAgents();

    expect(agentsService.patchAgent).not.toHaveBeenCalled();
  });

  it('does nothing when the prompt is already current', async () => {
    const { runner, agentsService } = buildRunner({
      taico: TAICO_PROMPT,
      'claude-dev': DEV_PROMPT,
    });

    await runner.ensureAgents();

    expect(agentsService.patchAgent).not.toHaveBeenCalled();
  });

  it('tolerates line-ending and edge whitespace differences in stored prompts', async () => {
    const { runner, agentsService } = buildRunner({
      taico: TAICO_PROMPT,
      developer: `${LEGACY_DEV_PROMPTS[0].replace(/\n/g, '\r\n')}\n\n`,
    });

    await runner.ensureAgents();

    expect(patchedSlugs(agentsService)).toEqual(['developer']);
  });
});
