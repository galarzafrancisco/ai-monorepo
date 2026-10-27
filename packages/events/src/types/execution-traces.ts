export interface ExecutionTracesChangedWireEvent {
  executionId: string;
}

/** Raw JSON from a harness, without formatter filtering or normalization. */
export type HarnessJson =
  | null
  | boolean
  | number
  | string
  | HarnessJson[]
  | { [key: string]: HarnessJson };

export interface ExecutionTraceEvent {
  sequence: number;
  emittedAt: string;
  runnerSessionId: string | null;
  payload: HarnessJson;
}

export interface PostExecutionTracePayload {
  executionId: string;
  harness: string;
  events: ExecutionTraceEvent[];
}

/** Permanent rejections are quarantined locally instead of retried forever. */
export interface ExecutionTraceAck {
  ok: boolean;
  permanent?: boolean;
  retryable?: "disconnected";
  error?: string;
}

// Keep batches below Socket.IO's transport limit. A single event can exceed the
// batching target; the server accepts frames up to EXECUTION_TRACE_MAX_BYTES.
export const EXECUTION_TRACE_BATCH_BYTES = 512 * 1024;
export const EXECUTION_TRACE_MAX_BYTES = 16 * 1024 * 1024;
export const EXECUTION_TRACE_BATCH_SIZE = 100;

/** Worker lifecycle records share the execution sequence with harness events. */
export type ExecutionStep = "workspace" | "setup" | "agent" | "finish";
export type ExecutionStepStatus =
  | "running"
  | "completed"
  | "failed"
  | "interrupted"
  | "cancelled";
export type ExecutionRepositoryProgress = {
  slug: string;
  repository: string;
  action: "clone" | "fetch";
  status: "running" | "completed" | "failed";
};
export type ExecutionStepEvent = {
  type: "taico.execution.step";
  step: ExecutionStep;
  status: ExecutionStepStatus;
  message?: string;
  repository?: ExecutionRepositoryProgress;
};
