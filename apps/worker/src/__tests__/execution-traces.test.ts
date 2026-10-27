import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { PostExecutionTracePayload } from "@taico/events";
import { HarnessTraceRecorder } from "../harness-trace-recorder.js";
import { ExecutionTraceSpool } from "../execution-trace-spool.js";
import { BaseAgentRunner } from "../runners/BaseAgentRunner.js";
import type { AgentRunContext } from "../runners/AgentRunner.js";

const batch = (): PostExecutionTracePayload => ({
  executionId: "f0db2a25-fb5b-4735-bdee-61d981cabf88",
  harness: "claude",
  events: [
    {
      sequence: 1,
      emittedAt: new Date().toISOString(),
      runnerSessionId: null,
      payload: {
        type: "tool_result",
        content: [{ text: "unfiltered output" }],
      },
    },
  ],
});

test("snapshots every JSON event with stable order and flushes the final batch", async () => {
  const batches: PostExecutionTracePayload[] = [];
  const recorder = new HarnessTraceRecorder(
    "execution",
    "adk",
    async (value) => {
      batches.push(value);
    },
  );
  const raw = { type: "tool_result", output: { full: "before mutation" } };
  recorder.capture(raw);
  raw.output.full = "mutated";
  recorder.setSession("session");
  recorder.capture({ type: "stream_event", delta: "token" });
  recorder.capture(null);
  await recorder.close();
  assert.deepEqual(
    batches[0].events.map((event) => event.sequence),
    [1, 2, 3],
  );
  assert.deepEqual(
    batches[0].events.map((event) => event.runnerSessionId),
    [null, "session", "session"],
  );
  assert.deepEqual(batches[0].events[0].payload, {
    type: "tool_result",
    output: { full: "before mutation" },
  });
  assert.equal(batches[0].events[2].payload, null);
});

test("batches a long stream and retains events received while persistence is in flight", async () => {
  const batches: PostExecutionTracePayload[] = [];
  let release!: () => void;
  const blocked = new Promise<void>((resolve) => {
    release = resolve;
  });
  const recorder = new HarnessTraceRecorder(
    "execution",
    "opencode",
    async (value) => {
      await blocked;
      batches.push(value);
    },
  );
  for (let i = 0; i < 250; i++) recorder.capture({ type: "delta", i });
  release();
  await recorder.close();
  assert.ok(batches.every((value) => value.events.length <= 100));
  assert.deepEqual(
    batches.flatMap((value) => value.events.map((event) => event.sequence)),
    Array.from({ length: 250 }, (_, i) => i + 1),
  );
});

test("batches large tool output by bytes without truncating it", async () => {
  const batches: PostExecutionTracePayload[] = [];
  const recorder = new HarnessTraceRecorder(
    "execution",
    "claude",
    async (value) => {
      batches.push(value);
    },
  );
  const content = "x".repeat(400_000);
  recorder.capture({ content });
  recorder.capture({ content });
  await recorder.close();
  assert.equal(batches.length, 2);
  assert.deepEqual(batches[1].events[0].payload, { content });
});

test("spooled batches survive a restart and are deleted only after ACK", async () => {
  const directory = await mkdtemp(join(tmpdir(), "taico-trace-test-"));
  let spool = new ExecutionTraceSpool(directory, async () => false);
  try {
    const original = batch();
    await spool.enqueue(original);
    await spool.drain();
    await spool.stop();
    assert.equal(
      (await readdir(directory)).filter((name) => name.endsWith(".json"))
        .length,
      1,
    );
    const uploaded: PostExecutionTracePayload[] = [];
    spool = new ExecutionTraceSpool(directory, async (value) => {
      uploaded.push(value);
      return true;
    });
    await spool.start();
    await spool.drain();
    assert.deepEqual(uploaded, [original]);
    assert.deepEqual(await readdir(directory), []);
  } finally {
    await spool.stop();
    await rm(directory, { recursive: true, force: true });
  }
});

test("raw callbacks run independently of formatter output, including on failure", async () => {
  const raw = [
    { type: "system" },
    { type: "tool_result", output: "full" },
    { type: "stream_event" },
  ];
  class FailingHarness extends BaseAgentRunner {
    readonly kind = "test";
    protected async runInternal(): Promise<string> {
      for (const value of raw) this.emitRawEvent(value);
      throw new Error("harness failed");
    }
  }
  const seen: unknown[] = [];
  await assert.rejects(
    new FailingHarness().run({} as AgentRunContext, {
      onHeartbeat() {},
      onRawEvent(event) {
        seen.push(event);
      },
    }),
    /harness failed/,
  );
  assert.deepEqual(seen, raw);
});

test("OpenCode and Codex expose ignored SDK events and session.idle before formatting", async () => {
  const { OpencodeAgentRunner } =
    await import("../runners/OpenCodeAgentRunner.js");
  const { CodexAgentRunner } = await import("../runners/CodexAgentRunner.js");
  const events = [
    { type: "server.connected", properties: {} },
    {
      type: "message.part.updated",
      properties: {
        delta: "token",
        part: { type: "text", text: "full", sessionID: "session" },
      },
    },
    {
      type: "permission.updated",
      properties: { sessionID: "session", id: "permission" },
    },
    { type: "session.idle", properties: { sessionID: "session" } },
  ];
  for (const runner of [new OpencodeAgentRunner(), new CodexAgentRunner()]) {
    runner.initBullshit = async () => {
      Object.assign(runner, {
        client: {
          session: {
            create: async () => ({
              data: { id: "session", directory: "/tmp" },
            }),
            promptAsync: async () => ({}),
          },
          event: {
            subscribe: async () => ({
              stream: (async function* () {
                yield* events;
              })(),
            }),
          },
        },
      });
    };
    const seen: unknown[] = [];
    await runner.run(
      {
        cwd: "/tmp",
        executionId: "execution",
        prompt: "test",
      } as AgentRunContext,
      {
        onHeartbeat() {},
        onRawEvent(event) {
          seen.push(event);
        },
      },
    );
    assert.deepEqual(seen, events);
  }
});

test("a failed batch blocks later batches of its execution while other executions upload", async () => {
  const directory = await mkdtemp(join(tmpdir(), "taico-trace-order-"));
  let online = false;
  const seen: string[] = [];
  const spool = new ExecutionTraceSpool(directory, async (value) => {
    if (!online) return false;
    seen.push(`${value.executionId}:${value.events[0].sequence}`);
    return value.executionId !== batch().executionId;
  });
  try {
    await spool.enqueue(batch());
    await spool.enqueue({
      ...batch(),
      events: [{ ...batch().events[0], sequence: 2 }],
    });
    const otherId = "f0db2a25-fb5b-4735-bdee-61d981cabf99";
    await spool.enqueue({ ...batch(), executionId: otherId });
    await spool.drain();
    online = true;
    await spool.drain();
    assert.deepEqual(seen, [`${batch().executionId}:1`, `${otherId}:1`]);
    assert.equal((await readdir(directory)).length, 2);
  } finally {
    await spool.stop();
    await rm(directory, { recursive: true, force: true });
  }
});
