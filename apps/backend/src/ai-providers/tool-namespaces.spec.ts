import { generateText, jsonSchema, tool, ToolSet } from 'ai';
import { MockLanguageModelV4 } from 'ai/test';
import {
  THREAD_TOOL_NAMESPACE,
  toolNamespaceFor,
  withToolNamespaceMiddleware,
} from './tool-namespaces';

const usage = {
  inputTokens: { total: 1, noCache: 1, cacheRead: undefined, cacheWrite: undefined },
  outputTokens: { total: 1, text: 1, reasoning: undefined },
};

type SentTool = {
  name: string;
  providerOptions?: { openai?: { namespace?: { name: string } } };
};
type SentPart = {
  type: string;
  toolName?: string;
  providerOptions?: { openai?: { namespace?: string } };
};

/** A provider-neutral model (no OpenAI namespace support) that records what it is sent. */
function recordingModel() {
  const calls: Array<{ tools?: SentTool[]; prompt: Array<{ role: string; content: unknown }> }> = [];
  const model = new MockLanguageModelV4({
    doGenerate: async (options) => {
      calls.push(options as never);
      return {
        content: [{ type: 'text' as const, text: 'ok' }],
        finishReason: { unified: 'stop' as const, raw: undefined },
        usage,
        warnings: [],
      };
    },
  });
  return { model: withToolNamespaceMiddleware(model), calls };
}

const noInput = jsonSchema<Record<string, never>>({ type: 'object', properties: {} });
const stub = (description: string) =>
  tool({ description, inputSchema: noInput, execute: async () => 'ok' });

describe('tool namespaces (every provider)', () => {
  it('maps prefixed tools to their server and the rest to the thread namespace', () => {
    expect(toolNamespaceFor('tasks__fetch').name).toBe('tasks');
    expect(toolNamespaceFor('context__get_block').name).toBe('context');
    expect(toolNamespaceFor('get_time')).toBe(THREAD_TOOL_NAMESPACE);
    expect(toolNamespaceFor('stay_silent')).toBe(THREAD_TOOL_NAMESPACE);
  });

  // With ~50 tools in one list, get_time and stay_silent sat at the end, where a model missed them.
  it('sends thread tools first and tags every tool with its namespace', async () => {
    const { model, calls } = recordingModel();
    const tools: ToolSet = {};
    for (let i = 0; i < 25; i++) tools[`tasks__tool_${i}`] = stub(`Task tool ${i}`);
    for (let i = 0; i < 16; i++) tools[`context__tool_${i}`] = stub(`Context tool ${i}`);
    tools.get_time = stub('Get the time');
    tools.stay_silent = stub('Stay silent');

    await generateText({ model, tools, prompt: 'what time is it?' });

    const sent = calls[0].tools!;
    expect(sent.slice(0, 2).map((t) => t.name)).toEqual(['get_time', 'stay_silent']);
    expect(sent).toHaveLength(43);
    expect(
      [...new Set(sent.map((t) => t.providerOptions?.openai?.namespace?.name))],
    ).toEqual(['taico', 'tasks', 'context']);
    // MCP tools keep their order.
    expect(sent[2].name).toBe('tasks__tool_0');
    expect(sent[42].name).toBe('context__tool_15');
  });

  it('gives replayed tool calls their current namespace, with or without an old one', async () => {
    const { model, calls } = recordingModel();

    await generateText({
      model,
      tools: { tasks__get_all_tags: stub('Tags'), get_time: stub('Time') },
      messages: [
        { role: 'user', content: 'hi' },
        {
          role: 'assistant',
          content: [
            // Recorded under the old single namespace (ChatGPT plan).
            { type: 'tool-call', toolCallId: 'c1', toolName: 'tasks__get_all_tags', input: {}, providerOptions: { openai: { namespace: 'taico' } } },
            // Recorded with no namespace (any other provider).
            { type: 'tool-call', toolCallId: 'c2', toolName: 'get_time', input: {} },
          ],
        },
        {
          role: 'tool',
          content: [
            { type: 'tool-result', toolCallId: 'c1', toolName: 'tasks__get_all_tags', output: { type: 'json', value: [] } },
            { type: 'tool-result', toolCallId: 'c2', toolName: 'get_time', output: { type: 'text', value: 'now' } },
          ],
        },
        { role: 'user', content: 'again' },
      ],
    });

    const replayed = calls[0].prompt
      .filter((m) => m.role === 'assistant')
      .flatMap((m) => m.content as SentPart[])
      .filter((p) => p.type === 'tool-call')
      .map((p) => [p.toolName, p.providerOptions?.openai?.namespace]);
    expect(replayed).toEqual([
      ['tasks__get_all_tags', 'tasks'],
      ['get_time', 'taico'],
    ]);
  });

  it('keeps provider and model id of the wrapped model', () => {
    const wrapped = withToolNamespaceMiddleware(
      new MockLanguageModelV4({ provider: 'anthropic.messages', modelId: 'claude-x' }),
    ) as { provider: string; modelId: string };
    expect(wrapped.provider).toBe('anthropic.messages');
    expect(wrapped.modelId).toBe('claude-x');
  });
});
