import { ApiProperty } from '@nestjs/swagger';

export class SearchSettingsDto {
  @ApiProperty({
    description:
      'Use embeddings. When off, search uses keywords and fuzzy title matching only.',
    example: true,
  })
  semanticEnabled!: boolean;

  @ApiProperty({
    description:
      'Target size of an embedded passage, in characters. Changing it re-embeds every item.',
    example: 1600,
  })
  chunkSizeChars!: number;

  @ApiProperty({
    description:
      'Characters repeated between consecutive pieces of one over-long paragraph. Changing it re-embeds every item.',
    example: 200,
  })
  chunkOverlapChars!: number;

  @ApiProperty({
    description:
      'Instruction sent with each query to instruction-aware embedding models. Leave empty for models that take none.',
    example: 'Given a search query, retrieve relevant passages that answer the query',
  })
  queryInstruction!: string;

  @ApiProperty({
    description:
      'How long a search waits for the query embedding before answering without semantic matches, in milliseconds.',
    example: 2000,
  })
  queryEmbeddingTimeoutMs!: number;

  @ApiProperty({
    description:
      'How many candidates each strategy contributes before the lists are merged.',
    example: 50,
  })
  candidatesPerStrategy!: number;

  @ApiProperty({
    description:
      'Lowest cosine similarity (0-1) at which a passage counts as a semantic match. Raise it to cut loosely related results.',
    example: 0.45,
  })
  semanticMinSimilarity!: number;

  @ApiProperty({
    description:
      'How far below the best semantic match a passage may be and still count. Trims the tail when something matches well. 1 turns it off.',
    example: 0.15,
  })
  semanticMaxGap!: number;

  @ApiProperty({
    description:
      'Lowest cover density at which a text counts as a keyword match. Filters out long texts that contain every term but far apart. 0 turns it off.',
    example: 0.005,
  })
  keywordMinDensity!: number;

  @ApiProperty({
    description:
      'Lowest trigram similarity (0-1) at which a title counts as a fuzzy match. Lower it to forgive more typos.',
    example: 0.5,
  })
  fuzzyMinSimilarity!: number;

  @ApiProperty({
    description:
      'Reciprocal rank fusion constant. Higher values flatten the difference between ranks.',
    example: 60,
  })
  rrfK!: number;

  @ApiProperty({
    description:
      'Weight of keyword matches in the merged ranking. 0 turns the strategy off.',
    example: 1,
  })
  keywordWeight!: number;

  @ApiProperty({
    description:
      'Weight of fuzzy title matches in the merged ranking. 0 turns the strategy off.',
    example: 1,
  })
  fuzzyTitleWeight!: number;

  @ApiProperty({
    description:
      'Weight of semantic matches in the merged ranking. 0 turns the strategy off.',
    example: 1,
  })
  semanticWeight!: number;

  @ApiProperty({
    description:
      'Added to the score when the query is the title; half of it when the title starts with the query.',
    example: 0.02,
  })
  exactTitleBoost!: number;

  @ApiProperty({
    description:
      'Score multiplier for finished tasks, so open work wins ties. 1 turns it off.',
    example: 0.9,
  })
  doneTaskMultiplier!: number;

  @ApiProperty({
    description:
      'Longest excerpt returned with a result, in characters. Shorter items are returned whole.',
    example: 1200,
  })
  excerptMaxChars!: number;

  @ApiProperty({
    description:
      'Results returned when a search does not ask for a number.',
    example: 10,
  })
  defaultLimit!: number;
}
