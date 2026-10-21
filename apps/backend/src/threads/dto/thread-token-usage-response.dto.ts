import { ApiProperty } from '@nestjs/swagger';
import { ThreadTokenUsageResult } from './service/threads.service.types';

/** Debug figures: taken from what the model provider reported, when it reported anything. */
export class ThreadTokenUsageResponseDto {
  @ApiProperty({
    description:
      'Input tokens of the most recent model step: roughly the size of the conversation the model reads now. Null when the provider reported no figure.',
    example: 42351,
    nullable: true,
    type: Number,
  })
  contextTokens!: number | null;

  @ApiProperty({
    description:
      'Input tokens summed over every model step in the thread. Null when no step reported a figure.',
    example: 423512,
    nullable: true,
    type: Number,
  })
  inputTokens!: number | null;

  @ApiProperty({
    description:
      'Output tokens summed over every model step in the thread. Null when no step reported a figure.',
    example: 8123,
    nullable: true,
    type: Number,
  })
  outputTokens!: number | null;

  @ApiProperty({
    description: 'Number of model steps that reported token usage',
    example: 12,
  })
  steps!: number;

  static fromResult(result: ThreadTokenUsageResult): ThreadTokenUsageResponseDto {
    const dto = new ThreadTokenUsageResponseDto();
    dto.contextTokens = result.contextTokens;
    dto.inputTokens = result.inputTokens;
    dto.outputTokens = result.outputTokens;
    dto.steps = result.steps;
    return dto;
  }
}
