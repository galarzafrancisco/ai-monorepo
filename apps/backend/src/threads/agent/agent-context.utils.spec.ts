import { AgentContextRow, buildModelMessages } from './agent-context.utils';

const target = { providerType: 'anthropic', modelId: 'claude-opus-5-5' };

const row = (overrides: Partial<AgentContextRow>): AgentContextRow => ({
  id: 'row-1',
  source: 'user',
  message: { role: 'user', content: 'hello' },
  formatVersion: 1,
  providerType: null,
  modelId: null,
  ...overrides,
});

const assistantWithReasoning = {
  role: 'assistant',
  content: [
    { type: 'reasoning', text: 'thinking', providerOptions: { openai: { itemId: 'rs_1' } } },
    { type: 'text', text: 'Let me check.', providerOptions: { openai: { itemId: 'msg_1' } } },
    { type: 'tool-call', toolCallId: 'c1', toolName: 'tasks__fetch', input: { id: '1' } },
  ],
};

describe('buildModelMessages', () => {
  it('keeps messages produced by the target model untouched', () => {
    const messages = buildModelMessages(
      [row({ message: assistantWithReasoning, ...target })],
      target,
    );

    expect(messages).toEqual([assistantWithReasoning]);
  });

  it('drops reasoning and provider options from messages produced by another model', () => {
    const messages = buildModelMessages(
      [row({ message: assistantWithReasoning, providerType: 'openai', modelId: 'gpt-5.4' })],
      target,
    );

    expect(messages).toEqual([
      {
        role: 'assistant',
        content: [
          { type: 'text', text: 'Let me check.' },
          { type: 'tool-call', toolCallId: 'c1', toolName: 'tasks__fetch', input: { id: '1' } },
        ],
      },
    ]);
  });

  it('drops a message from another model that only contained reasoning', () => {
    const messages = buildModelMessages(
      [
        row({
          message: { role: 'assistant', content: [{ type: 'reasoning', text: 'thinking' }] },
          providerType: 'openai',
          modelId: 'gpt-5.4',
        }),
      ],
      target,
    );

    expect(messages).toEqual([]);
  });

  it('skips and reports rows that do not match the message schema', () => {
    const invalid: string[] = [];
    const messages = buildModelMessages(
      [
        row({ id: 'bad-shape', message: { role: 'nobody', content: 42 } }),
        row({ id: 'bad-version', formatVersion: 99 }),
        row({ id: 'good' }),
      ],
      target,
      (r) => invalid.push(r.id),
    );

    expect(messages).toEqual([{ role: 'user', content: 'hello' }]);
    expect(invalid).toEqual(['bad-shape', 'bad-version']);
  });

  it('leaves out system rows without reporting them', () => {
    const invalid: string[] = [];
    const messages = buildModelMessages(
      [
        row({ id: 'question' }),
        row({
          id: 'hook-context',
          source: 'hook:easter-egg',
          message: { role: 'system', content: '<context source="easter-egg">\nhi\n</context>' },
        }),
      ],
      target,
      (r) => invalid.push(r.id),
    );

    expect(messages).toEqual([{ role: 'user', content: 'hello' }]);
    expect(invalid).toEqual([]);
  });
});
