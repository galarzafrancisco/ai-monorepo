import { ApiProperty } from '@nestjs/swagger';
import { ExecutionStatsResult } from '../service/execution-results.service.types';

export class ExecutionStatsResponseDto {
  @ApiProperty({
    type: String,
    description: 'Harness used to execute the run',
    example: 'opencode',
    nullable: true,
  })
  harness!: string | null;

  @ApiProperty({
    type: String,
    description: 'LLM provider id resolved for this run',
    example: 'openai',
    nullable: true,
  })
  providerId!: string | null;

  @ApiProperty({
    type: String,
    description: 'LLM model id resolved for this run',
    example: 'gpt-5.4',
    nullable: true,
  })
  modelId!: string | null;

  @ApiProperty({
    type: String,
    description: 'Taico worker package version used for this run',
    example: '0.2.16',
    nullable: true,
  })
  workerVersion!: string | null;

  @ApiProperty({
    type: Number,
    description: 'Input token usage when available',
    example: 1200,
    nullable: true,
  })
  inputTokens!: number | null;

  @ApiProperty({
    type: Number,
    description: 'Output token usage when available',
    example: 380,
    nullable: true,
  })
  outputTokens!: number | null;

  @ApiProperty({
    type: Number,
    description: 'Total token usage when available',
    example: 1580,
    nullable: true,
  })
  totalTokens!: number | null;

  static fromResult(result: ExecutionStatsResult): ExecutionStatsResponseDto {
    return {
      harness: result.harness,
      providerId: result.providerId,
      modelId: result.modelId,
      workerVersion: result.workerVersion,
      inputTokens: result.inputTokens,
      outputTokens: result.outputTokens,
      totalTokens: result.totalTokens,
    };
  }
}
