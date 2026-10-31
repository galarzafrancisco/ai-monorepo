import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { AgentResponseDto } from '@taico/client/v2';
import { buildFollowUpPrompt } from '../prompt.js';
import { ClaudeAgentRunner } from '../runners/ClaudeAgentRunner.js';
import type { AgentRunContext, TokenUsage } from '../runners/AgentRunner.js';

type Message = Record<string, unknown>;
type Call = { prompt: string; resume?: string };

const init = { type: 'system', subtype: 'init', session_id: 'session-1' };
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
