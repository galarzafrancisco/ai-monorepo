import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { AgentResponseDto } from '@taico/client/v2';
import { buildFollowUpPrompt } from '../prompt.js';
import { ClaudeAgentRunner } from '../runners/ClaudeAgentRunner.js';
import { CodexAgentRunner } from '../runners/CodexAgentRunner.js';
import { OpencodeAgentRunner } from '../runners/OpenCodeAgentRunner.js';
import type { AgentRunContext, TokenUsage } from '../runners/AgentRunner.js';

type Message = Record<string, unknown>;
type Call = { prompt: string; resume?: string };

const init = {
  type: 'system',
  subtype: 'init',
  session_id: 'session-1',
  model: 'test-model',
  tools: [],
  mcp_servers: [],
  slash_commands: [],
  skills: [],
  plugins: [],
};
const success = (result: string, tokens = 10) => ({
  type: 'result',
  subtype: 'success',
  result,
  usage: { input_tokens: tokens, output_tokens: tokens },
});

/** Replays one scripted list of messages per query. */
function runnerWith(turns: Array<Message[] | Error>) {
  const calls: Call[] = [];
  class ScriptedRunner extends ClaudeAgentRunner {
    protected override readonly startQuery = ((params: {
      prompt: string;
      options: { resume?: string };
    }) => {
      calls.push({ prompt: params.prompt, resume: params.options.resume });
      const turn = turns.shift() ?? [];
      return (async function* () {
        if (turn instanceof Error) throw turn;
        yield* turn;
      })();
    }) as unknown as ClaudeAgentRunner['startQuery'];
  }
  return { runner: new ScriptedRunner(), calls };
}

const ctx = (overrides: Partial<AgentRunContext> = {}): AgentRunContext => ({
  taskId: 'task',
  prompt: 'do the work',
  cwd: '/tmp',
  baseUrl: 'http://unused',
  accessToken: 'token',
  executionId: 'execution',
  ...overrides,
});

test('sends the follow-up once on the same session, then finishes', async () => {
  const { runner, calls } = runnerWith([
    [init, success('first')],
    [init, success('second')],
  ]);

  const result = await runner.run(ctx({ followUpPrompt: 'check your work' }));

  assert.deepEqual(calls, [
    { prompt: 'do the work', resume: undefined },
    { prompt: 'check your work', resume: 'session-1' },
  ]);
  assert.equal(result.result, 'second');
});

test('reports the follow-up start between the two turns', async () => {
  const { runner, calls } = runnerWith([
    [init, success('first')],
    [init, success('second')],
  ]);
  const queriesAtStart: number[] = [];

  await runner.run(ctx({ followUpPrompt: 'check your work' }), {
    onHeartbeat: () => undefined,
    onFollowUpStart: () => queriesAtStart.push(calls.length),
  });

  assert.deepEqual(queriesAtStart, [1]);
});

test('does not report a follow-up start when none is sent', async () => {
  const { runner } = runnerWith([[init, success('only')]]);
  let started = false;

  await runner.run(ctx(), {
    onHeartbeat: () => undefined,
    onFollowUpStart: () => {
      started = true;
    },
  });

  assert.equal(started, false);
});

test('without a follow-up the run ends after the first turn', async () => {
  const { runner, calls } = runnerWith([[init, success('only')]]);

  await runner.run(ctx());

  assert.equal(calls.length, 1);
});

test('does not follow up a turn that did not succeed', async () => {
  const { runner, calls } = runnerWith([
    [init, { type: 'result', subtype: 'error_max_turns' }],
  ]);

  await runner.run(ctx({ followUpPrompt: 'check your work' }));

  assert.equal(calls.length, 1);
});

test('does not follow up a success result flagged as an error', async () => {
  const { runner, calls } = runnerWith([
    [init, { ...success('quota exceeded'), is_error: true }],
  ]);
  const errors: string[] = [];

  const result = await runner.run(ctx({ followUpPrompt: 'check your work' }), {
    onHeartbeat: () => undefined,
    onError: ({ message }) => {
      errors.push(message);
    },
  });

  assert.equal(calls.length, 1);
  assert.deepEqual(errors, ['quota exceeded']);
  assert.equal(result.result, 'quota exceeded');
});

test('does not follow up after the run was interrupted', async () => {
  const abort = new AbortController();
  abort.abort();
  const { runner, calls } = runnerWith([[init, success('first')]]);

  await runner.run(
    ctx({ followUpPrompt: 'check your work', abortSignal: abort.signal }),
  );

  assert.equal(calls.length, 1);
});

test('an overloaded follow-up retries the follow-up, not the original prompt', async () => {
  const { runner, calls } = runnerWith([
    [init, success('first')],
    new Error('529 overloaded_error'),
    [init, success('second')],
  ]);

  await runner.run(ctx({ followUpPrompt: 'check your work' }));

  assert.deepEqual(
    calls.map((call) => call.prompt),
    ['do the work', 'check your work', 'check your work'],
  );
});

test('token usage covers both turns', async () => {
  const { runner } = runnerWith([
    [init, success('first', 10)],
    [init, success('second', 5)],
  ]);
  let latest: TokenUsage = {};

  await runner.run(ctx({ followUpPrompt: 'check your work' }), {
    onHeartbeat: () => undefined,
    onTokenUsage: (usage) => {
      latest = { ...usage };
    },
  });

  assert.deepEqual(latest, {
    inputTokens: 15,
    outputTokens: 15,
    totalTokens: 30,
  });
});

test('buildFollowUpPrompt only applies to normal runs with a prompt set', () => {
  const agent = (followUpPrompt: string | null) =>
    ({ followUpPrompt }) as unknown as AgentResponseDto;

  assert.equal(buildFollowUpPrompt(agent(' check '), 'normal'), 'check');
  assert.equal(buildFollowUpPrompt(agent('check'), 'input_request'), undefined);
  assert.equal(buildFollowUpPrompt(agent(null), 'normal'), undefined);
  assert.equal(buildFollowUpPrompt(agent('   '), 'normal'), undefined);
});

const idle = (sessionID: string) => ({
  type: 'session.idle',
  properties: { sessionID },
});
const failed = (sessionID?: string) => ({
  type: 'session.error',
  properties: { sessionID },
});

/**
 * Replays events on a server-wide stream and records how many prompts had been
 * sent by the time each event was read.
 */
async function runOpencode(
  Runner: typeof OpencodeAgentRunner | typeof CodexAgentRunner,
  events: Message[],
) {
  const prompts: string[] = [];
  const promptsSentBefore: number[] = [];
  const runner = new Runner();
  runner.initBullshit = async () => {
    Object.assign(runner, {
      client: {
        session: {
          create: async () => ({ data: { id: 'parent', directory: '/tmp' } }),
          promptAsync: async ({
            body,
          }: {
            body: { parts: Array<{ text: string }> };
          }) => {
            prompts.push(body.parts[0].text);
            return {};
          },
        },
        event: {
          subscribe: async () => ({
            stream: (async function* () {
              for (const event of events) {
                promptsSentBefore.push(prompts.length);
                yield event;
              }
            })(),
          }),
        },
      },
    });
  };

  await runner.run(ctx({ followUpPrompt: 'check your work' }));
  return { prompts, promptsSentBefore };
}

for (const Runner of [OpencodeAgentRunner, CodexAgentRunner]) {
  test(`${Runner.name}: subagent sessions don't move the parent's turn along`, async () => {
    const { prompts, promptsSentBefore } = await runOpencode(Runner, [
      idle('child'),
      idle('parent'),
      idle('child'),
      idle('parent'),
      idle('never-read'),
    ]);

    assert.deepEqual(prompts, ['do the work', 'check your work']);
    // Sent only after the parent's first idle, and the run ended on its second.
    assert.deepEqual(promptsSentBefore, [1, 1, 2, 2]);
  });

  test(`${Runner.name}: a subagent error doesn't cancel the follow-up`, async () => {
    const { prompts } = await runOpencode(Runner, [
      failed('child'),
      idle('child'),
      idle('parent'),
      idle('parent'),
    ]);

    assert.deepEqual(prompts, ['do the work', 'check your work']);
  });

  test(`${Runner.name}: an error on the session cancels the follow-up`, async () => {
    const { prompts } = await runOpencode(Runner, [
      failed('parent'),
      idle('parent'),
    ]);

    assert.deepEqual(prompts, ['do the work']);
  });

  test(`${Runner.name}: an error with no session cancels the follow-up`, async () => {
    const { prompts } = await runOpencode(Runner, [failed(), idle('parent')]);

    assert.deepEqual(prompts, ['do the work']);
  });
}
