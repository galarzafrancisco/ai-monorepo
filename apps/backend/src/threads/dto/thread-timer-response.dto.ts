import { ApiProperty } from '@nestjs/swagger';
import { ThreadTimerKind } from '../timers/thread-timer.enums';
import { ThreadTimerResult } from './service/threads.service.types';

export class ThreadTimerResponseDto {
  @ApiProperty({
    description: 'Timer ID; use it to cancel the timer',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  id!: string;

  @ApiProperty({
    description: 'reminder fires once; schedule fires every period, up to maxIterations times',
    enum: ThreadTimerKind,
    enumName: 'ThreadTimerKind',
    example: ThreadTimerKind.SCHEDULE,
  })
  kind!: ThreadTimerKind;

  @ApiProperty({
    description: 'What the threads agent wants to be reminded of',
    example: 'Check task #123 for new comments',
  })
  reason!: string;

  @ApiProperty({
    description: 'Seconds between firings (null for a reminder)',
    example: 300,
    type: Number,
    nullable: true,
  })
  periodSeconds!: number | null;

  @ApiProperty({ description: 'Most times the timer fires', example: 5 })
  maxIterations!: number;

  @ApiProperty({ description: 'Times the timer has fired so far', example: 1 })
  firedCount!: number;

  @ApiProperty({
    description: 'When the timer fires next (UTC)',
    example: '2024-01-15T10:35:00.000Z',
  })
  nextFireAt!: string;

  @ApiProperty({
    description: 'When the timer was set (UTC)',
    example: '2024-01-15T10:30:00.000Z',
  })
  createdAt!: string;

  static fromResult(result: ThreadTimerResult): ThreadTimerResponseDto {
    return {
      id: result.id,
      kind: result.kind,
      reason: result.reason,
      periodSeconds: result.periodSeconds,
      maxIterations: result.maxIterations,
      firedCount: result.firedCount,
      nextFireAt: result.nextFireAt.toISOString(),
      createdAt: result.createdAt.toISOString(),
    };
  }
}
