import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ExecutionTracesChangedEvent } from '../events/execution-traces-changed.event';
import { LessThan, MoreThan, Repository } from 'typeorm';
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
    private readonly eventEmitter: EventEmitter2,
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

    // Pass payloads directly as json, without jsonb conversion or JSON text
    // extraction: either would reject valid escaped NULs and lone surrogates.
    const parameters: unknown[] = [
      input.executionId,
      input.harness,
      input.source ?? 'harness',
    ];
    const rows = input.events.map((event) => {
      const offset = parameters.length;
      parameters.push(
        event.sequence,
        event.emittedAt,
        event.runnerSessionId,
        JSON.stringify(event.payload),
      );
      return `($1::uuid, $2, $3, $${offset + 1}::integer, $${offset + 2}::timestamptz, $${offset + 3}, $${offset + 4}::json)`;
    });
    const inserted = await this.traces.query(
      `INSERT INTO execution_traces (execution_id, harness, source, sequence, emitted_at, runner_session_id, payload)
       VALUES ${rows.join(', ')}
       ON CONFLICT (execution_id, sequence) DO NOTHING RETURNING sequence`,
      parameters,
    );
    if (inserted.length) {
      this.eventEmitter.emit(
        ExecutionTracesChangedEvent.INTERNAL,
        new ExecutionTracesChangedEvent(input.executionId),
      );
    }
  }

  async list(
    executionId: string,
    afterSequence: number,
    limit: number,
    options: { latest?: boolean; beforeSequence?: number } = {},
  ) {
    await this.resolveExecution(executionId);
    const backwards = options.latest || options.beforeSequence !== undefined;
    const [items, lifecycle] = await Promise.all([
      this.traces.find({
        where: {
          executionId,
          sequence:
            options.beforeSequence !== undefined
              ? LessThan(options.beforeSequence)
              : MoreThan(afterSequence),
        },
        order: { sequence: backwards ? 'DESC' : 'ASC' },
        take: limit + 1,
      }),
      this.traces.find({
        where: { executionId, source: 'worker' },
        order: { sequence: 'ASC' },
      }),
    ]);
    const hasMore = items.length > limit;
    if (hasMore) items.pop();
    if (backwards) items.reverse();
    return {
      items,
      lifecycle,
      nextAfterSequence: items.at(-1)?.sequence ?? afterSequence,
      hasMoreBefore: Boolean(backwards && hasMore),
    };
  }

  private async resolveExecution(
    executionId: string,
  ): Promise<{ workerClientId: string }> {
    // A single snapshot avoids a race when an execution moves to history.
    const [execution] = await this.traces.query(
      `
      SELECT worker_client_id AS "workerClientId"
      FROM active_task_executions WHERE id = $1 AND deleted_at IS NULL
      UNION ALL
      SELECT worker_client_id AS "workerClientId"
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
    const source = input?.source === undefined ? 'harness' : input.source;
    if (
      !input ||
      (source !== 'worker' && source !== 'harness') ||
      typeof input.executionId !== 'string' ||
      !isUUID(input.executionId) ||
      (source === 'worker'
        ? input.harness !== null
        : typeof input.harness !== 'string' ||
          !input.harness.length ||
          input.harness.length > 100) ||
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
