import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { MoreThan, Repository } from 'typeorm';
import { isISO8601, isUUID } from 'class-validator';
import {
  EXECUTION_TRACE_BATCH_SIZE,
  EXECUTION_TRACE_MAX_BYTES,
  type PostExecutionTracePayload,
} from '@taico/events';
import { ExecutionTraceEntity } from './execution-trace.entity';
import {
  ExecutionTraceNotFoundError,
  ExecutionTraceWorkerMismatchError,
  InvalidExecutionTraceError,
} from './execution-traces.errors';

@Injectable()
export class ExecutionTracesService {
  constructor(
    @InjectRepository(ExecutionTraceEntity)
    private readonly traces: Repository<ExecutionTraceEntity>,
  ) {}

  async append(
    input: PostExecutionTracePayload,
    workerClientId: string,
  ): Promise<void> {
    this.validate(input);
    const execution = await this.resolveExecution(input.executionId);
    if (!workerClientId || execution.workerClientId !== workerClientId) {
      throw new ExecutionTraceWorkerMismatchError(input.executionId);
    }

    // One INSERT per batch. Retrying an acknowledged or partially acknowledged
    // upload is safe, and cannot overwrite events already stored.
    await this.traces.query(
      `
      INSERT INTO execution_traces (execution_id, task_id, harness, sequence, emitted_at, runner_session_id, payload)
      SELECT $1::uuid, $2::uuid, $3, (event->>'sequence')::integer,
             (event->>'emittedAt')::timestamptz, event->>'runnerSessionId', event->'payload'
      FROM jsonb_array_elements($4::jsonb) AS event
      ON CONFLICT (execution_id, sequence) DO NOTHING`,
      [
        input.executionId,
        execution.taskId,
        input.harness,
        JSON.stringify(input.events),
      ],
    );
  }

  async list(executionId: string, afterSequence: number, limit: number) {
    await this.resolveExecution(executionId);
    const items = await this.traces.find({
      where: { executionId, sequence: MoreThan(afterSequence) },
      order: { sequence: 'ASC' },
      take: limit,
    });
    return {
      items,
      nextAfterSequence: items.at(-1)?.sequence ?? afterSequence,
    };
  }

  private async resolveExecution(
    executionId: string,
  ): Promise<{ taskId: string; workerClientId: string }> {
    // A single snapshot avoids a race when an execution moves to history.
    const [execution] = await this.traces.query(
      `
      SELECT task_id AS "taskId", worker_client_id AS "workerClientId"
      FROM active_task_executions WHERE id = $1 AND deleted_at IS NULL
      UNION ALL
      SELECT task_id AS "taskId", worker_client_id AS "workerClientId"
      FROM task_execution_history WHERE id = $1 AND deleted_at IS NULL
      LIMIT 1`,
      [executionId],
    );
    if (!execution) throw new ExecutionTraceNotFoundError(executionId);
    return execution;
  }

  private validate(input: PostExecutionTracePayload): void {
    const invalid = () => {
      throw new InvalidExecutionTraceError('Invalid execution trace batch.');
    };
    if (
      !input ||
      typeof input.executionId !== 'string' ||
      !isUUID(input.executionId) ||
      typeof input.harness !== 'string' ||
      !input.harness.length ||
      input.harness.length > 100 ||
      !Array.isArray(input.events) ||
      !input.events.length ||
      input.events.length > EXECUTION_TRACE_BATCH_SIZE
    )
      invalid();
    let previous = 0;
    for (const event of input.events) {
      if (
        !event ||
        !Number.isInteger(event.sequence) ||
        event.sequence <= previous ||
        event.sequence > 2147483647 ||
        typeof event.emittedAt !== 'string' ||
        !isISO8601(event.emittedAt, { strict: true }) ||
        (event.runnerSessionId !== null &&
          typeof event.runnerSessionId !== 'string') ||
        !Object.prototype.hasOwnProperty.call(event, 'payload') ||
        event.payload === undefined
      )
        invalid();
      previous = event.sequence;
    }
    // JSON.stringify also rejects non-JSON values such as circular references.
    try {
      if (
        Buffer.byteLength(JSON.stringify(input)) >
        EXECUTION_TRACE_MAX_BYTES - 1024
      )
        invalid();
    } catch {
      invalid();
    }
  }
}
