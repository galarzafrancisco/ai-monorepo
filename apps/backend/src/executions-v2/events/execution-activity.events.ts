export type ExecutionActivityPayload = {
  executionId: string;
  taskId: string;
  agentActorId: string;
  kind: string;
  message?: string;
  ts: number;
  runnerSessionId?: string | null;
};

export class ExecutionActivityEvent {
  static readonly INTERNAL = Symbol('executions-v2.ExecutionActivityEvent');

  readonly occurredAt: Date = new Date();

  constructor(
    public readonly actor: { id: string },
    public readonly payload: ExecutionActivityPayload,
  ) {}
}
