import {
  EXECUTION_TRACE_BATCH_BYTES,
  EXECUTION_TRACE_BATCH_SIZE,
  type ExecutionTraceEvent,
  type HarnessJson,
  type PostExecutionTracePayload,
} from "@taico/events";

/** Capture synchronously so SDK objects cannot mutate before serialization. */
export class HarnessTraceRecorder {
  private sequence = 0;
  private sessionId: string | null = null;
  private pending: Array<{ event: ExecutionTraceEvent; bytes: number }> = [];
  private pendingBytes = 0;
  private flushing?: Promise<void>;
  private readonly timer: ReturnType<typeof setInterval>;

  constructor(
    private readonly executionId: string,
    private readonly harness: string,
    private readonly persist: (
      batch: PostExecutionTracePayload,
    ) => Promise<void>,
  ) {
    this.timer = setInterval(() => void this.flush(), 1_000);
    this.timer.unref();
  }

  setSession(sessionId: string): void {
    this.sessionId = sessionId;
  }

  capture(payload: unknown): void {
    let snapshot: HarnessJson;
    try {
      const serialized = JSON.stringify(payload);
      if (serialized === undefined)
        throw new Error("Harness emitted a non-JSON event");
      snapshot = JSON.parse(serialized) as HarnessJson;
    } catch {
      // Observability must never abort a harness, including on circular SDK data.
      snapshot = {
        captureError: "Harness event could not be serialized as JSON",
      };
      console.warn(`[worker] Non-JSON trace event for ${this.executionId}`);
    }
    const event: ExecutionTraceEvent = {
      sequence: ++this.sequence,
      emittedAt: new Date().toISOString(),
      runnerSessionId: this.sessionId,
      payload: snapshot,
    };
    const bytes = Buffer.byteLength(JSON.stringify(event));
    this.pending.push({ event, bytes });
    this.pendingBytes += bytes;
    if (
      this.pending.length >= EXECUTION_TRACE_BATCH_SIZE ||
      this.pendingBytes >= EXECUTION_TRACE_BATCH_BYTES
    ) {
      void this.flush();
    }
  }

  async close(): Promise<void> {
    clearInterval(this.timer);
    await this.flush();
    if (this.pending.length) {
      console.warn(
        `[worker] Unable to spool ${this.pending.length} harness trace events for ${this.executionId}`,
      );
      this.pending = [];
      this.pendingBytes = 0;
    }
  }

  private flush(): Promise<void> {
    if (this.flushing) return this.flushing;
    this.flushing = this.persistPending()
      .catch((error) => {
        console.warn(
          `[worker] Trace spooling failed for ${this.executionId}: ${error instanceof Error ? error.message : String(error)}`,
        );
      })
      .finally(() => {
        this.flushing = undefined;
      });
    return this.flushing;
  }

  private async persistPending(): Promise<void> {
    while (this.pending.length) {
      let bytes = 0;
      let count = 0;
      for (const item of this.pending) {
        if (
          count >= EXECUTION_TRACE_BATCH_SIZE ||
          (count && bytes + item.bytes > EXECUTION_TRACE_BATCH_BYTES)
        )
          break;
        bytes += item.bytes;
        count++;
      }
      const events = this.pending.slice(0, count).map(({ event }) => event);
      await this.persist({
        executionId: this.executionId,
        harness: this.harness,
        events,
      });
      this.pending.splice(0, count);
      this.pendingBytes -= bytes;
    }
  }
}
