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
import type { PostExecutionTracePayload } from "@taico/events";

/** Durable pending batches. An ACK is issued only after the backend INSERT. */
export class ExecutionTraceSpool {
  private timer?: ReturnType<typeof setInterval>;
  private draining?: Promise<void>;

  constructor(
    private readonly directory: string,
    private readonly send: (
      batch: PostExecutionTracePayload,
    ) => Promise<boolean>,
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
    if (this.draining) return this.draining;
    this.draining = this.uploadPending()
      .catch((error) => {
        console.warn(
          `[worker] Trace upload deferred: ${error instanceof Error ? error.message : String(error)}`,
        );
      })
      .finally(() => {
        this.draining = undefined;
      });
    return this.draining;
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
      try {
        const batch: PostExecutionTracePayload = JSON.parse(
          await readFile(filename, "utf8"),
        );
        if (await this.send(batch)) {
          await unlink(filename);
        } else {
          blockedExecutions.add(executionId);
        }
      } catch (error) {
        blockedExecutions.add(executionId);
        console.warn(
          `[worker] Trace batch ${name} deferred: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }
  }
}
