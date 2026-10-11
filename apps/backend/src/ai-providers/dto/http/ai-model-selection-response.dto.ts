import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AiModelJob } from '../../enums';

export class AiModelSelectionResponseDto {
  @ApiProperty({
    description: 'The job the model is selected for',
    enum: AiModelJob,
    example: AiModelJob.CONVERSATION,
  })
  job!: AiModelJob;

  @ApiPropertyOptional({
    type: String,
    description: "Provider of the job's own selection. Null when nothing is selected for it.",
    example: '123e4567-e89b-12d3-a456-426614174000',
    nullable: true,
  })
  aiProviderId!: string | null;

  @ApiPropertyOptional({
    type: String,
    description: "Model of the job's own selection. Null when nothing is selected for it.",
    example: 'claude-opus-5-5',
    nullable: true,
  })
  modelId!: string | null;

  @ApiProperty({
    description: 'True when the job has no selection of its own and uses the conversation model',
    example: false,
  })
  followsConversation!: boolean;

  @ApiPropertyOptional({
    type: String,
    description: 'Provider the job runs on after applying the fallback',
    example: '123e4567-e89b-12d3-a456-426614174000',
    nullable: true,
  })
  effectiveAiProviderId!: string | null;

  @ApiPropertyOptional({
    type: String,
    description: 'Model the job runs on after applying the fallback',
    example: 'claude-opus-5-5',
    nullable: true,
  })
  effectiveModelId!: string | null;

  @ApiProperty({
    description: 'Whether the job can make a call: a model is selected and its provider is configured',
    example: true,
  })
  isReady!: boolean;
}
