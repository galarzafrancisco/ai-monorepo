import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import {
  MAX_QUERY_INSTRUCTION_CHARS,
  SEARCH_SETTINGS_BOUNDS as BOUNDS,
} from '../../search/index/search-settings';

/** Every field is optional: only the settings sent are changed. */
export class UpdateSearchSettingsDto {
  @ApiPropertyOptional({
    description:
      'Use embeddings. When off, search uses keywords and fuzzy title matching only.',
  })
  @IsOptional()
  @IsBoolean()
  semanticEnabled?: boolean;

  @ApiPropertyOptional({
    description:
      'Target size of an embedded passage, in characters. Changing it re-embeds every item.',
    minimum: BOUNDS.chunkSizeChars.min,
    maximum: BOUNDS.chunkSizeChars.max,
  })
  @IsOptional()
  @(BOUNDS.chunkSizeChars.integer ? IsInt() : IsNumber())
  @Min(BOUNDS.chunkSizeChars.min)
  @Max(BOUNDS.chunkSizeChars.max)
  chunkSizeChars?: number;

  @ApiPropertyOptional({
    description:
      'Characters repeated between consecutive pieces of one over-long paragraph. Changing it re-embeds every item.',
    minimum: BOUNDS.chunkOverlapChars.min,
    maximum: BOUNDS.chunkOverlapChars.max,
  })
  @IsOptional()
  @(BOUNDS.chunkOverlapChars.integer ? IsInt() : IsNumber())
  @Min(BOUNDS.chunkOverlapChars.min)
  @Max(BOUNDS.chunkOverlapChars.max)
  chunkOverlapChars?: number;

  @ApiPropertyOptional({
    description:
      'Instruction sent with each query to instruction-aware embedding models. Leave empty for models that take none.',
    maxLength: MAX_QUERY_INSTRUCTION_CHARS,
  })
  @IsOptional()
  @IsString()
  @MaxLength(MAX_QUERY_INSTRUCTION_CHARS)
  queryInstruction?: string;

  @ApiPropertyOptional({
    description:
      'How long a search waits for the query embedding before answering without semantic matches, in milliseconds.',
    minimum: BOUNDS.queryEmbeddingTimeoutMs.min,
    maximum: BOUNDS.queryEmbeddingTimeoutMs.max,
  })
  @IsOptional()
  @(BOUNDS.queryEmbeddingTimeoutMs.integer ? IsInt() : IsNumber())
  @Min(BOUNDS.queryEmbeddingTimeoutMs.min)
  @Max(BOUNDS.queryEmbeddingTimeoutMs.max)
  queryEmbeddingTimeoutMs?: number;

  @ApiPropertyOptional({
    description:
      'How many candidates each strategy contributes before the lists are merged.',
    minimum: BOUNDS.candidatesPerStrategy.min,
    maximum: BOUNDS.candidatesPerStrategy.max,
  })
  @IsOptional()
  @(BOUNDS.candidatesPerStrategy.integer ? IsInt() : IsNumber())
  @Min(BOUNDS.candidatesPerStrategy.min)
  @Max(BOUNDS.candidatesPerStrategy.max)
  candidatesPerStrategy?: number;

  @ApiPropertyOptional({
    description:
      'Lowest cosine similarity (0-1) at which a passage counts as a semantic match. Raise it to cut loosely related results.',
    minimum: BOUNDS.semanticMinSimilarity.min,
    maximum: BOUNDS.semanticMinSimilarity.max,
  })
  @IsOptional()
  @(BOUNDS.semanticMinSimilarity.integer ? IsInt() : IsNumber())
  @Min(BOUNDS.semanticMinSimilarity.min)
  @Max(BOUNDS.semanticMinSimilarity.max)
  semanticMinSimilarity?: number;

  @ApiPropertyOptional({
    description:
      'How far below the best semantic match a passage may be and still count. Trims the tail when something matches well. 1 turns it off.',
    minimum: BOUNDS.semanticMaxGap.min,
    maximum: BOUNDS.semanticMaxGap.max,
  })
  @IsOptional()
  @(BOUNDS.semanticMaxGap.integer ? IsInt() : IsNumber())
  @Min(BOUNDS.semanticMaxGap.min)
  @Max(BOUNDS.semanticMaxGap.max)
  semanticMaxGap?: number;

  @ApiPropertyOptional({
    description:
      'Lowest cover density at which a text counts as a keyword match. Filters out long texts that contain every term but far apart. 0 turns it off.',
    minimum: BOUNDS.keywordMinDensity.min,
    maximum: BOUNDS.keywordMinDensity.max,
  })
  @IsOptional()
  @(BOUNDS.keywordMinDensity.integer ? IsInt() : IsNumber())
  @Min(BOUNDS.keywordMinDensity.min)
  @Max(BOUNDS.keywordMinDensity.max)
  keywordMinDensity?: number;

  @ApiPropertyOptional({
    description:
      'Lowest trigram similarity (0-1) at which a title counts as a fuzzy match. Lower it to forgive more typos.',
    minimum: BOUNDS.fuzzyMinSimilarity.min,
    maximum: BOUNDS.fuzzyMinSimilarity.max,
  })
  @IsOptional()
  @(BOUNDS.fuzzyMinSimilarity.integer ? IsInt() : IsNumber())
  @Min(BOUNDS.fuzzyMinSimilarity.min)
  @Max(BOUNDS.fuzzyMinSimilarity.max)
  fuzzyMinSimilarity?: number;

  @ApiPropertyOptional({
    description:
      'Reciprocal rank fusion constant. Higher values flatten the difference between ranks.',
    minimum: BOUNDS.rrfK.min,
    maximum: BOUNDS.rrfK.max,
  })
  @IsOptional()
  @(BOUNDS.rrfK.integer ? IsInt() : IsNumber())
  @Min(BOUNDS.rrfK.min)
  @Max(BOUNDS.rrfK.max)
  rrfK?: number;

  @ApiPropertyOptional({
    description:
      'Weight of keyword matches in the merged ranking. 0 turns the strategy off.',
    minimum: BOUNDS.keywordWeight.min,
    maximum: BOUNDS.keywordWeight.max,
  })
  @IsOptional()
  @(BOUNDS.keywordWeight.integer ? IsInt() : IsNumber())
  @Min(BOUNDS.keywordWeight.min)
  @Max(BOUNDS.keywordWeight.max)
  keywordWeight?: number;

  @ApiPropertyOptional({
    description:
      'Weight of fuzzy title matches in the merged ranking. 0 turns the strategy off.',
    minimum: BOUNDS.fuzzyTitleWeight.min,
    maximum: BOUNDS.fuzzyTitleWeight.max,
  })
  @IsOptional()
  @(BOUNDS.fuzzyTitleWeight.integer ? IsInt() : IsNumber())
  @Min(BOUNDS.fuzzyTitleWeight.min)
  @Max(BOUNDS.fuzzyTitleWeight.max)
  fuzzyTitleWeight?: number;

  @ApiPropertyOptional({
    description:
      'Weight of semantic matches in the merged ranking. 0 turns the strategy off.',
    minimum: BOUNDS.semanticWeight.min,
    maximum: BOUNDS.semanticWeight.max,
  })
  @IsOptional()
  @(BOUNDS.semanticWeight.integer ? IsInt() : IsNumber())
  @Min(BOUNDS.semanticWeight.min)
  @Max(BOUNDS.semanticWeight.max)
  semanticWeight?: number;

  @ApiPropertyOptional({
    description:
      'Added to the score when the query is the title; half of it when the title starts with the query.',
    minimum: BOUNDS.exactTitleBoost.min,
    maximum: BOUNDS.exactTitleBoost.max,
  })
  @IsOptional()
  @(BOUNDS.exactTitleBoost.integer ? IsInt() : IsNumber())
  @Min(BOUNDS.exactTitleBoost.min)
  @Max(BOUNDS.exactTitleBoost.max)
  exactTitleBoost?: number;

  @ApiPropertyOptional({
    description:
      'Score multiplier for finished tasks, so open work wins ties. 1 turns it off.',
    minimum: BOUNDS.doneTaskMultiplier.min,
    maximum: BOUNDS.doneTaskMultiplier.max,
  })
  @IsOptional()
  @(BOUNDS.doneTaskMultiplier.integer ? IsInt() : IsNumber())
  @Min(BOUNDS.doneTaskMultiplier.min)
  @Max(BOUNDS.doneTaskMultiplier.max)
  doneTaskMultiplier?: number;

  @ApiPropertyOptional({
    description:
      'Longest excerpt returned with a result, in characters. Shorter items are returned whole.',
    minimum: BOUNDS.excerptMaxChars.min,
    maximum: BOUNDS.excerptMaxChars.max,
  })
  @IsOptional()
  @(BOUNDS.excerptMaxChars.integer ? IsInt() : IsNumber())
  @Min(BOUNDS.excerptMaxChars.min)
  @Max(BOUNDS.excerptMaxChars.max)
  excerptMaxChars?: number;

  @ApiPropertyOptional({
    description:
      'Results returned when a search does not ask for a number.',
    minimum: BOUNDS.defaultLimit.min,
    maximum: BOUNDS.defaultLimit.max,
  })
  @IsOptional()
  @(BOUNDS.defaultLimit.integer ? IsInt() : IsNumber())
  @Min(BOUNDS.defaultLimit.min)
  @Max(BOUNDS.defaultLimit.max)
  defaultLimit?: number;
}
