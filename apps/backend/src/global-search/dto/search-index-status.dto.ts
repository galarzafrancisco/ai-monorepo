import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SearchIndexTypeStatusDto {
  @ApiProperty({ description: 'Kind of indexed item', example: 'comment' })
  type!: string;

  @ApiProperty({ description: 'Indexed items of this kind', example: 120 })
  documents!: number;

  @ApiProperty({ description: 'Of those, how many have up-to-date embeddings', example: 118 })
  embedded!: number;
}

export class SearchIndexStatusDto {
  @ApiProperty({ description: 'Whether searches currently use embeddings', example: true })
  semanticActive!: boolean;

  @ApiPropertyOptional({
    type: String,
    description: 'Why semantic search is not active. Null when it is.',
    example: null,
    nullable: true,
  })
  semanticInactiveReason!: string | null;

  @ApiPropertyOptional({
    type: String,
    description: 'The embedding model in use. Null when there is no usable one.',
    example: 'Qwen3-Embedding-0.6B',
    nullable: true,
  })
  embeddingModelId!: string | null;

  @ApiProperty({
    description: 'Indexed items: tasks, comments, context blocks, tools, agents and projects',
    example: 340,
  })
  documents!: number;

  @ApiProperty({ description: 'Items with up-to-date embeddings', example: 338 })
  embedded!: number;

  @ApiProperty({ description: 'Items waiting to be embedded', example: 2 })
  pending!: number;

  @ApiProperty({ description: 'Items whose last embedding attempt failed', example: 0 })
  failed!: number;

  @ApiPropertyOptional({
    type: String,
    description: 'The most recent embedding error. Null when nothing is failing.',
    example: null,
    nullable: true,
  })
  lastError!: string | null;

  @ApiProperty({ type: [SearchIndexTypeStatusDto], description: 'The same counts per kind of item' })
  byType!: SearchIndexTypeStatusDto[];
}
