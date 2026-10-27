import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readdir, readFile, rm } from "node:fs/promises";
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
  let spool = new ExecutionTraceSpool(directory, async () => ({ ok: false }));
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
      return { ok: true };
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
  let now = 0;
  const seen: string[] = [];
  const spool = new ExecutionTraceSpool(
    directory,
    async (value) => {
      if (!online) return { ok: false };
      seen.push(`${value.executionId}:${value.events[0].sequence}`);
      return { ok: value.executionId !== batch().executionId };
    },
    () => now,
  );
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
    now += 5_000;
    await spool.drain();
    assert.deepEqual(seen, [`${batch().executionId}:1`, `${otherId}:1`]);
    assert.equal((await readdir(directory)).length, 2);
  } finally {
    await spool.stop();
    await rm(directory, { recursive: true, force: true });
  }
});

test("non-JSON SDK events become diagnostic entries without aborting capture", async () => {
  const batches: PostExecutionTracePayload[] = [];
  const recorder = new HarnessTraceRecorder(
    "execution",
    "claude",
    async (value) => {
      batches.push(value);
    },
  );
  const circular: Record<string, unknown> = {};
  circular.self = circular;
  for (const raw of [circular, { value: 1n }, undefined]) recorder.capture(raw);
  recorder.capture({ text: "continues" });
  await recorder.close();
  assert.deepEqual(
    batches[0].events.map((event) => event.sequence),
    [1, 2, 3, 4],
  );
  for (const event of batches[0].events.slice(0, 3))
    assert.ok((event.payload as Record<string, unknown>).captureError);
  assert.deepEqual(batches[0].events[3].payload, { text: "continues" });
});

test("disk failures never replace the agent result or original error", async () => {
  for (const outcome of ["success", new Error("agent interrupted")]) {
    const recorder = new HarnessTraceRecorder(
      "execution",
      "claude",
      async () => {
        throw new Error("ENOSPC");
      },
    );
    const run = async () => {
      try {
        recorder.capture({ text: "output" });
        if (outcome instanceof Error) throw outcome;
        return outcome;
      } finally {
        await recorder.close();
      }
    };
    if (outcome instanceof Error)
      await assert.rejects(run, (error) => error === outcome);
    else assert.equal(await run(), "success");
  }
});

test("permanent rejection preserves the failed batch and unblocks later sequences", async () => {
  const directory = await mkdtemp(join(tmpdir(), "taico-trace-permanent-"));
  const sent: number[] = [];
  const spool = new ExecutionTraceSpool(directory, async (value) => {
    const sequence = value.events[0].sequence;
    sent.push(sequence);
    return sequence === 1 ? { ok: false, permanent: true } : { ok: true };
  });
  try {
    const original = batch();
    await spool.enqueue(original);
    await spool.enqueue({
      ...batch(),
      events: [{ ...batch().events[0], sequence: 2 }],
    });
    await spool.drain();
    assert.deepEqual(sent, [1, 2]);
    const failed = await readdir(join(directory, "failed"));
    assert.equal(failed.length, 1);
    assert.deepEqual(
      JSON.parse(await readFile(join(directory, "failed", failed[0]), "utf8")),
      original,
    );
    await spool.drain();
    assert.deepEqual(sent, [1, 2]);
  } finally {
    await spool.stop();
    await rm(directory, { recursive: true, force: true });
  }
});

test("oversized events are quarantined before transport without blocking later batches", async () => {
  const directory = await mkdtemp(join(tmpdir(), "taico-trace-large-"));
  const sent: number[] = [];
  const spool = new ExecutionTraceSpool(directory, async (value) => {
    sent.push(value.events[0].sequence);
    return { ok: true };
  });
  try {
    const large = batch();
    large.events[0].payload = { text: "x".repeat(16 * 1024 * 1024) };
    await spool.enqueue(large);
    await spool.enqueue({
      ...batch(),
      events: [{ ...batch().events[0], sequence: 2 }],
    });
    await spool.drain();
    assert.deepEqual(sent, [2]);
    assert.equal((await readdir(join(directory, "failed"))).length, 1);
  } finally {
    await spool.stop();
    await rm(directory, { recursive: true, force: true });
  }
});

test("transient upload failures back off while retaining ordered durable delivery", async () => {
  const directory = await mkdtemp(join(tmpdir(), "taico-trace-backoff-"));
  let now = 0;
  let attempts = 0;
  const spool = new ExecutionTraceSpool(
    directory,
    async () => ({ ok: ++attempts === 3 }),
    () => now,
  );
  try {
    await spool.enqueue(batch());
    await spool.drain();
    assert.equal(attempts, 1);
    now = 4_999;
    await spool.drain();
    assert.equal(attempts, 1);
    now = 5_000;
    await spool.drain();
    assert.equal(attempts, 2);
    now = 14_999;
    await spool.drain();
    assert.equal(attempts, 2);
    now = 15_000;
    await spool.drain();
    assert.equal(attempts, 3);
    assert.deepEqual(await readdir(directory), []);
  } finally {
    await spool.stop();
    await rm(directory, { recursive: true, force: true });
  }
});
