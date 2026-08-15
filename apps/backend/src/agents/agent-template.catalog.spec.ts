import { AgentType } from './enums';
import {
  AGENT_TEMPLATE_HARNESSES,
  AGENT_TEMPLATES,
} from './agent-template.catalog';

describe('AGENT_TEMPLATE_HARNESSES', () => {
  it('offers Grok 4.6 exactly once through the existing OpenCode harness', () => {
    const openCodeHarness = AGENT_TEMPLATE_HARNESSES.find(
      ({ type }) => type === AgentType.OPENCODE,
    );
    const grokOptions = openCodeHarness?.modelOptions.filter(
      ({ label }) => label === 'Grok 4.6',
    );

    expect(grokOptions).toEqual([
      expect.objectContaining({
        label: 'Grok 4.6',
        providerId: 'xai',
        modelId: 'grok-4.6',
      }),
    ]);
    expect(Object.values(AgentType)).toEqual([
      AgentType.CLAUDE,
      AgentType.CODEX,
      AgentType.OPENCODE,
      AgentType.ADK,
      AgentType.GITHUBCOPILOT,
      AgentType.OTHER,
    ]);
    expect(AGENT_TEMPLATE_HARNESSES.map(({ type }) => type)).toEqual(
      Object.values(AgentType),
    );
    expect(AGENT_TEMPLATES.some(({ id }) => id === 'grok')).toBe(false);
  });
});
