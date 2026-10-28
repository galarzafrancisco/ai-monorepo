import { ApiProperty } from '@nestjs/swagger';
import { ThreadWatchKind } from '../watches/thread-watch.enums';
import { ThreadWatchResult } from '../watches/thread-watches.service';

export class ThreadWatchResponseDto {
  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000' })
  id!: string;

  @ApiProperty({ enum: ThreadWatchKind, enumName: 'ThreadWatchKind', example: ThreadWatchKind.PULL_REQUEST })
  kind!: ThreadWatchKind;

  @ApiProperty({ description: 'What is watched, e.g. a pull request id', example: '123e4567-e89b-12d3-a456-426614174000' })
  targetId!: string;

  @ApiProperty({ description: 'How to show what is watched', example: 'acme/api#12' })
  targetLabel!: string;

  @ApiProperty({ type: String, nullable: true, example: 'https://github.com/acme/api/pull/12' })
  targetUrl!: string | null;

  @ApiProperty({ type: [String], description: 'What the agent is waiting for', example: ['checks_finished'] })
  conditions!: string[];

  @ApiProperty({ description: 'The watch ends after its first notification', example: true })
  once!: boolean;

  @ApiProperty({ type: String, nullable: true, example: 'Tell me when CI passes so I can merge' })
  waitingFor!: string | null;

  @ApiProperty({ example: '2026-01-04T10:30:00.000Z' })
  expiresAt!: string;

  @ApiProperty({ example: '2026-01-01T10:30:00.000Z' })
  createdAt!: string;

  static fromResult(result: ThreadWatchResult): ThreadWatchResponseDto {
    return {
      id: result.id,
      kind: result.kind,
      targetId: result.targetId,
      targetLabel: result.targetLabel,
      targetUrl: result.targetUrl,
      conditions: result.conditions,
      once: result.once,
      waitingFor: result.waitingFor,
      expiresAt: result.expiresAt.toISOString(),
      createdAt: result.createdAt.toISOString(),
    };
  }
}
