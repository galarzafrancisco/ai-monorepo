import type { TestContext } from 'node:test';
import { CopilotClient } from '@github/copilot-sdk';
import { OpencodeAgentRunner } from '../runners/OpenCodeAgentRunner.js';

type Event = Record<string, unknown>;

export const opencodeIdle = (sessionID: string) => ({
  type: 'session.idle',
  properties: { sessionID },
});
export const opencodeBusy = (sessionID: string) => ({
  type: 'session.status',
  properties: { sessionID, status: { type: 'busy' } },
});
export const opencodeError = (sessionID?: string, error?: unknown) => ({
  type: 'session.error',
  properties: { sessionID, error },
});

export const copilotIdle = (data: Event = {}, agentId?: string) => ({
  type: 'session.idle',
  agentId,
  data,
});
export const copilotError = (data: Event, agentId?: string) => ({
  type: 'session.error',
  agentId,
  data,
});

/** An OpenCode client whose session is "parent" and replays `events`. */
export function fakeOpencodeClient(
  events: Event[],
  onEvent: () => void = () => undefined,
) {
  const prompts: string[] = [];
  const client = {
    session: {
      create: async () => ({ data: { id: 'parent', directory: '/tmp' } }),
      abort: async () => ({ data: true }),
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
            onEvent();
            yield event;
          }
        })(),
      }),
    },
  };
  return { client, prompts };
}

/** Makes every OpenCode and Codex runner in this test use a fake server. */
export function mockOpencode(t: TestContext, events: Event[]) {
  const fake = fakeOpencodeClient(events);
  t.mock.method(
    OpencodeAgentRunner.prototype,
    'initBullshit',
    async function (this: OpencodeAgentRunner) {
      Object.assign(this, { client: fake.client });
    },
  );
  return fake.prompts;
}

/** Makes Copilot replay one list of events per prompt sent. */
export function mockCopilot(t: TestContext, turns: Event[][]) {
  const prompts: string[] = [];
  const handlers = new Map<string, Array<(event: Event) => unknown>>();
  const session = {
    sessionId: 'session',
    workspacePath: '/tmp',
    abort: async () => undefined,
    on: (type: string, handler: (event: Event) => unknown) => {
      handlers.set(type, [...(handlers.get(type) ?? []), handler]);
    },
    send: async ({ prompt }: { prompt: string }) => {
      prompts.push(prompt);
      const turn = turns.shift() ?? [];
      setImmediate(async () => {
        for (const event of turn) {
          for (const handler of handlers.get(event.type as string) ?? []) {
            await handler(event);
          }
        }
      });
    },
  };
  t.mock.method(CopilotClient.prototype, 'start', async () => undefined);
  t.mock.method(CopilotClient.prototype, 'stop', async () => []);
  t.mock.method(
    CopilotClient.prototype,
    'createSession',
    (async () => session) as unknown as CopilotClient['createSession'],
  );
  return { prompts, session };
}
