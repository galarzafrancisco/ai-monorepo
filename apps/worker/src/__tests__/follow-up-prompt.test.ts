import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Runner as AdkRunner } from '@google/adk';
import type { AgentResponseDto } from '@taico/client/v2';
import { buildFollowUpPrompt } from '../prompt.js';
import { ADKAgentRunner } from '../runners/ADKAgentRunner.js';
import { ClaudeAgentRunner } from '../runners/ClaudeAgentRunner.js';
import { CodexAgentRunner } from '../runners/CodexAgentRunner.js';
import { GitHubCopilotAgentRunner } from '../runners/GitHubCopilotAgentRunner.js';
import { OpencodeAgentRunner } from '../runners/OpenCodeAgentRunner.js';
import {
  AgentQuotaExceededError,
  AgentReportedError,
  InterruptedExecutionError,
} from '../task-execution-errors.js';
import type { AgentRunContext, TokenUsage } from '../runners/AgentRunner.js';
import {
  copilotError,
  copilotIdle,
  fakeOpencodeClient,
  mockCopilot,
  opencodeBusy,
  opencodeError,
  opencodeIdle,
} from './harness-fakes.js';

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

const idle = opencodeIdle;
const failed = opencodeError;

/**
 * Replays events on a server-wide stream and records how many prompts had been
 * sent by the time each event was read. `error` is what the run failed with.
 */
async function runOpencode(
  Runner: typeof OpencodeAgentRunner | typeof CodexAgentRunner,
  events: Message[],
  { abortOnEvent }: { abortOnEvent?: number } = {},
) {
  const promptsSentBefore: number[] = [];
  const abort = new AbortController();
  const fake = fakeOpencodeClient(events, () => {
    if (promptsSentBefore.length === abortOnEvent) abort.abort();
    promptsSentBefore.push(fake.prompts.length);
  });
  const runner = new Runner();
  runner.initBullshit = async () => {
    Object.assign(runner, { client: fake.client });
  };

  const error: unknown = await runner
    .run(ctx({ followUpPrompt: 'check your work', abortSignal: abort.signal }))
    .then(
      () => undefined,
      (err) => err,
    );
  return { prompts: fake.prompts, promptsSentBefore, error };
}

const apiError = (statusCode: number, message: string) => ({
  name: 'APIError',
  data: { message, statusCode, isRetryable: false },
});

for (const Runner of [OpencodeAgentRunner, CodexAgentRunner]) {
  test(`${Runner.name}: subagent sessions don't move the parent's turn along`, async () => {
    const { prompts, promptsSentBefore, error } = await runOpencode(Runner, [
      idle('child'),
      idle('parent'),
      idle('child'),
      idle('parent'),
      idle('never-read'),
    ]);

    assert.equal(error, undefined);
    assert.deepEqual(prompts, ['do the work', 'check your work']);
    // Sent only after the parent's first idle, and the run ended on its second.
    assert.deepEqual(promptsSentBefore, [1, 1, 2, 2]);
  });

  test(`${Runner.name}: a subagent error doesn't fail the run`, async () => {
    const { prompts, error } = await runOpencode(Runner, [
      failed('child', apiError(500, 'subagent broke')),
      idle('child'),
      idle('parent'),
      idle('parent'),
    ]);

    assert.equal(error, undefined);
    assert.deepEqual(prompts, ['do the work', 'check your work']);
  });

  test(`${Runner.name}: a first-turn error fails the run with its details and skips the follow-up`, async () => {
    const { prompts, error } = await runOpencode(Runner, [
      failed('parent', apiError(401, 'bad key')),
      idle('parent'),
    ]);

    assert.ok(error instanceof AgentReportedError);
    assert.equal(error.message, 'OpenCode APIError 401: bad key');
    assert.deepEqual(prompts, ['do the work']);
  });

  test(`${Runner.name}: a follow-up error fails the run`, async () => {
    const { prompts, error } = await runOpencode(Runner, [
      idle('parent'),
      failed('parent', apiError(500, 'follow-up broke')),
      idle('parent'),
    ]);

    assert.ok(error instanceof AgentReportedError);
    assert.deepEqual(prompts, ['do the work', 'check your work']);
  });

  test(`${Runner.name}: quota errors are classified as quota errors`, async () => {
    const { error } = await runOpencode(Runner, [
      failed('parent', apiError(429, 'quota exceeded')),
      idle('parent'),
    ]);

    assert.ok(error instanceof AgentQuotaExceededError);
  });

  test(`${Runner.name}: an error without a message still fails the run`, async () => {
    const { error } = await runOpencode(Runner, [
      failed('parent', { name: 'MessageOutputLengthError', data: {} }),
      idle('parent'),
    ]);

    assert.ok(error instanceof AgentReportedError);
    assert.equal(error.message, 'OpenCode MessageOutputLengthError');
  });

  // Event order recorded from opencode 1.19.3: the overflow is reported as an
  // error, then the session compacts and finishes the turn.
  test(`${Runner.name}: a context overflow that compacts doesn't fail the run`, async () => {
    const { prompts, error } = await runOpencode(Runner, [
      failed('parent', {
        name: 'ContextOverflowError',
        data: { message: 'too long' },
      }),
      opencodeBusy('parent'),
      idle('parent'),
      idle('parent'),
    ]);

    assert.equal(error, undefined);
    assert.deepEqual(prompts, ['do the work', 'check your work']);
  });

  test(`${Runner.name}: a context overflow with no compaction fails the run`, async () => {
    const { error } = await runOpencode(Runner, [
      failed('parent', {
        name: 'ContextOverflowError',
        data: { message: 'too long' },
      }),
      idle('parent'),
    ]);

    assert.ok(error instanceof AgentReportedError);
  });

  test(`${Runner.name}: plugin and skill errors, which have no session, don't fail the run`, async () => {
    const { prompts, error } = await runOpencode(Runner, [
      failed(undefined, {
        name: 'UnknownError',
        data: { message: 'Failed to parse skill' },
      }),
      idle('parent'),
      idle('parent'),
    ]);

    assert.equal(error, undefined);
    assert.deepEqual(prompts, ['do the work', 'check your work']);
  });

  test(`${Runner.name}: an interrupt wins over the abort error it causes`, async () => {
    const { prompts, error } = await runOpencode(
      Runner,
      [
        idle('parent'),
        failed('parent', {
          name: 'MessageAbortedError',
          data: { message: 'aborted' },
        }),
        idle('parent'),
      ],
      { abortOnEvent: 1 },
    );

    assert.ok(error instanceof InterruptedExecutionError);
    assert.deepEqual(prompts, ['do the work', 'check your work']);
  });

  test(`${Runner.name}: an abort from outside the worker counts as interrupted`, async () => {
    const { error } = await runOpencode(Runner, [
      failed('parent', {
        name: 'MessageAbortedError',
        data: { message: 'aborted' },
      }),
      idle('parent'),
    ]);

    assert.ok(error instanceof InterruptedExecutionError);
  });
}

const copilotRun = (abortSignal?: AbortSignal) =>
  new GitHubCopilotAgentRunner()
    .run(ctx({ followUpPrompt: 'check your work', abortSignal }))
    .then(
      () => undefined,
      (err: unknown) => err,
    );
const rateLimited = {
  errorType: 'rate_limit',
  statusCode: 429,
  message: 'slow down',
};

test('Copilot: a clean run sends the follow-up and finishes', async (t) => {
  const { prompts } = mockCopilot(t, [[copilotIdle()], [copilotIdle()]]);

  assert.equal(await copilotRun(), undefined);
  assert.deepEqual(prompts, ['do the work', 'check your work']);
});

test('Copilot: a first-turn error fails the run with its details and skips the follow-up', async (t) => {
  const { prompts } = mockCopilot(t, [
    [copilotError(rateLimited), copilotIdle()],
    [copilotIdle()],
  ]);

  const error = await copilotRun();

  assert.ok(error instanceof AgentQuotaExceededError);
  assert.equal(error.message, 'Copilot rate limit 429: slow down');
  assert.deepEqual(prompts, ['do the work']);
});

test('Copilot: a follow-up error fails the run', async (t) => {
  const { prompts } = mockCopilot(t, [
    [copilotIdle()],
    [copilotError({ errorType: 'query', message: 'broke' })],
  ]);

  const error = await copilotRun();

  assert.ok(error instanceof AgentReportedError);
  assert.equal(error.message, 'Copilot query: broke');
  assert.deepEqual(prompts, ['do the work', 'check your work']);
});

test("Copilot: subagent events don't fail or advance the turn", async (t) => {
  const { prompts } = mockCopilot(t, [
    [
      copilotError({ errorType: 'query', message: 'broke' }, 'subagent'),
      copilotIdle({}, 'subagent'),
      copilotIdle(),
    ],
    [copilotIdle()],
  ]);

  assert.equal(await copilotRun(), undefined);
  assert.deepEqual(prompts, ['do the work', 'check your work']);
});

test('Copilot: an interrupt wins over the error it causes', async (t) => {
  const abort = new AbortController();
  const { session, prompts } = mockCopilot(t, [
    [copilotError({ errorType: 'query', message: 'aborted' })],
  ]);
  const send = session.send;
  session.send = async (message) => {
    abort.abort();
    await send(message);
  };

  const error = await copilotRun(abort.signal);

  assert.ok(error instanceof InterruptedExecutionError);
  assert.deepEqual(prompts, ['do the work']);
});

test('Copilot: an aborted idle is interrupted and skips the follow-up', async (t) => {
  const { prompts } = mockCopilot(t, [[copilotIdle({ aborted: true })]]);

  const error = await copilotRun();

  assert.ok(error instanceof InterruptedExecutionError);
  assert.deepEqual(prompts, ['do the work']);
});

const adkError = { errorCode: '429', errorMessage: 'quota exceeded' };
const adkReply = { content: { role: 'model', parts: [{ text: 'done' }] } };

test('ADK: an error event fails the run and skips the follow-up', async (t) => {
  const turns = [[adkError], [adkReply]];
  const prompts: unknown[] = [];
  t.mock.method(AdkRunner.prototype, 'runAsync', async function* (params: {
    newMessage: { parts: Array<{ text: string }> };
  }) {
    prompts.push(params.newMessage.parts[0].text);
    yield* turns.shift() ?? [];
  } as unknown as AdkRunner['runAsync']);
  let followUpStarted = false;

  await assert.rejects(
    new ADKAgentRunner().run(
      ctx({ followUpPrompt: 'check your work', mcpServers: {} }),
      {
        onHeartbeat: () => undefined,
        onFollowUpStart: () => {
          followUpStarted = true;
        },
      },
    ),
    (error: unknown) => {
      assert.ok(error instanceof AgentQuotaExceededError);
      assert.equal(error.displayMessage, 'ADK error 429: quota exceeded');
      return true;
    },
  );

  assert.deepEqual(prompts, ['do the work']);
  assert.equal(followUpStarted, false);
});

test('ADK: an error event keeps its token usage', async (t) => {
  t.mock.method(AdkRunner.prototype, 'runAsync', async function* () {
    yield {
      errorCode: 'MAX_TOKENS',
      usageMetadata: { promptTokenCount: 3, candidatesTokenCount: 4 },
    };
  } as unknown as AdkRunner['runAsync']);
  let latest: TokenUsage = {};

  await assert.rejects(
    new ADKAgentRunner().run(ctx({ mcpServers: {} }), {
      onHeartbeat: () => undefined,
      onTokenUsage: (usage) => {
        latest = usage;
      },
    }),
    /ADK error MAX_TOKENS/,
  );

  assert.deepEqual(latest, {
    inputTokens: 3,
    outputTokens: 4,
    totalTokens: 7,
  });
});
