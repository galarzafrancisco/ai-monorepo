import { ApiProperty } from '@nestjs/swagger';
import type { HarnessJson } from '@taico/events';
import { ExecutionTraceEntity } from '../../execution-trace.entity';

export class ExecutionTraceResponseDto {
  @ApiProperty() executionId!: string;
  @ApiProperty() sequence!: number;
  @ApiProperty() harness!: string;
  @ApiProperty({ type: String, nullable: true }) runnerSessionId!:
    | string
    | null;
  @ApiProperty({ format: 'date-time' }) emittedAt!: string;
  @ApiProperty({ format: 'date-time' }) receivedAt!: string;
  @ApiProperty({
    description: 'Unmodified harness JSON event',
    type: 'object',
    additionalProperties: true,
    nullable: true,
  })
  payload!: HarnessJson;

  static fromEntity(event: ExecutionTraceEntity): ExecutionTraceResponseDto {
    return {
      executionId: event.executionId,
      sequence: event.sequence,
      harness: event.harness,
      runnerSessionId: event.runnerSessionId,
      emittedAt: event.emittedAt.toISOString(),
      receivedAt: event.receivedAt.toISOString(),
      payload: event.payload as HarnessJson,
    };
  }
}

export class ExecutionTracesResponseDto {
  @ApiProperty({ type: [ExecutionTraceResponseDto] })
  items!: ExecutionTraceResponseDto[];
  @ApiProperty()
  hasMoreBefore!: boolean;
  @ApiProperty() nextAfterSequence!: number;
}
