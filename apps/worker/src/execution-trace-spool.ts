import {
  mkdir,
  readdir,
  readFile,
  rename,
  unlink,
  writeFile,
} from "node:fs/promises";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import {
  EXECUTION_TRACE_MAX_BYTES,
  type ExecutionTraceAck,
  type PostExecutionTracePayload,
} from "@taico/events";

/** Durable pending batches. An ACK is issued only after the backend INSERT. */
export class ExecutionTraceSpool {
  private timer?: ReturnType<typeof setInterval>;
  private draining?: Promise<void>;
  private drainRequested = false;
  private readonly retries = new Map<
    string,
    { attempts: number; after: number }
  >();

  constructor(
    private readonly directory: string,
    private readonly send: (
      batch: PostExecutionTracePayload,
    ) => Promise<ExecutionTraceAck>,
    private readonly now: () => number = Date.now,
  ) {}

  async start(): Promise<void> {
    await mkdir(this.directory, { recursive: true, mode: 0o700 });
    this.timer = setInterval(() => void this.drain(), 5_000);
    this.timer.unref();
    void this.drain();
  }

  async enqueue(batch: PostExecutionTracePayload): Promise<void> {
    await mkdir(this.directory, { recursive: true, mode: 0o700 });
    const filename = join(
      this.directory,
      `${batch.executionId}-${String(batch.events[0].sequence).padStart(10, "0")}-${randomUUID()}.json`,
    );
    // Atomic publication means recovery never reads a partly written batch.
    await writeFile(`${filename}.tmp`, JSON.stringify(batch), { mode: 0o600 });
    await rename(`${filename}.tmp`, filename);
    void this.drain();
  }

  drain(): Promise<void> {
    this.drainRequested = true;
    if (this.draining) return this.draining;
    this.draining = (async () => {
      do {
        this.drainRequested = false;
        await this.uploadPending();
      } while (this.drainRequested);
    })()
      .catch((error) => {
        console.warn(
          `[worker] Trace upload deferred: ${error instanceof Error ? error.message : String(error)}`,
        );
      })
      .finally(() => {
        this.draining = undefined;
        if (this.drainRequested) void this.drain();
      });
    return this.draining;
  }

  /** A healthy new transport should not inherit delays from the old one. */
  resume(): Promise<void> {
    this.retries.clear();
    return this.drain();
  }

  async stop(): Promise<void> {
    if (this.timer) clearInterval(this.timer);
    await this.draining;
  }

  private async uploadPending(): Promise<void> {
    const filenames = (await readdir(this.directory))
      .filter((name) => name.endsWith(".json"))
      .sort();
    const blockedExecutions = new Set<string>();
    for (const name of filenames) {
      // Keep each execution ordered, but do not let one failing execution
      // prevent unrelated executions from uploading.
      const executionId = name.slice(0, 36);
      if (blockedExecutions.has(executionId)) continue;
      const filename = join(this.directory, name);
      const retry = this.retries.get(name);
      if (retry && this.now() < retry.after) {
        blockedExecutions.add(executionId);
        continue;
      }
      try {
        const serialized = await readFile(filename, "utf8");
        if (Buffer.byteLength(serialized) > EXECUTION_TRACE_MAX_BYTES - 1024) {
          await this.quarantine(name, "batch exceeds transport limit");
          continue;
        }
        let batch: PostExecutionTracePayload;
        try {
          batch = JSON.parse(serialized);
        } catch {
          await this.quarantine(name, "invalid spool JSON");
          continue;
        }
        const ack = await this.send(batch);
        if (ack.ok) {
          await unlink(filename);
          this.retries.delete(name);
        } else if (ack.permanent) {
          await this.quarantine(name, "server permanently rejected batch");
        } else {
          if (ack.retryable !== "disconnected") this.defer(name);
          blockedExecutions.add(executionId);
        }
      } catch (error) {
        this.defer(name);
        blockedExecutions.add(executionId);
        console.warn(
          `[worker] Trace batch ${name} deferred: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }
  }

  private defer(name: string): void {
    const attempts = (this.retries.get(name)?.attempts ?? 0) + 1;
    const delay = Math.min(300_000, 5_000 * 2 ** Math.min(attempts - 1, 6));
    this.retries.set(name, { attempts, after: this.now() + delay });
  }

  private async quarantine(name: string, reason: string): Promise<void> {
    const failed = join(this.directory, "failed");
    await mkdir(failed, { recursive: true, mode: 0o700 });
    await rename(join(this.directory, name), join(failed, name));
    this.retries.delete(name);
    console.warn(`[worker] Trace batch ${name} moved to failed/: ${reason}`);
  }
}
