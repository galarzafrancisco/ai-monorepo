import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { SearchMatchField, SearchResultType, SearchStrategy } from '../../search/enums';

export class GlobalSearchResultDto {
  @ApiProperty({
    description: 'Result ID',
    example: 'ba1cffdd-6c42-4cfc-ab00-ba1cf934fb81',
  })
  id!: string;

  @ApiProperty({
    description: 'Result type',
    enum: SearchResultType,
    enumName: 'SearchResultType',
    example: SearchResultType.TASK,
  })
  type!: SearchResultType;

  @ApiProperty({
    description: 'Result title/name',
    example: 'Implement authentication',
  })
  title!: string;

  @ApiProperty({
    description:
      'Relevance from 0 to 1, for ordering results within this response. Not comparable between searches.',
    example: 0.85,
    minimum: 0,
    maximum: 1,
  })
  score!: number;

  @ApiProperty({
    description: 'Frontend URL path to navigate to this resource',
    example: '/tasks/task/ba1cffdd-6c42-4cfc-ab00-ba1cf934fb81',
  })
  url!: string;

  @ApiProperty({
    description: 'The search strategies that found this result',
    enum: SearchStrategy,
    enumName: 'SearchStrategy',
    isArray: true,
    example: [SearchStrategy.KEYWORD, SearchStrategy.SEMANTIC],
  })
  matchedBy!: SearchStrategy[];

  @ApiProperty({
    description:
      'Which part of the item matched best: its title, a passage of its text, or a comment on it',
    enum: SearchMatchField,
    enumName: 'SearchMatchField',
    example: SearchMatchField.CONTENT,
  })
  matchedOn!: SearchMatchField;

  @ApiProperty({
    description:
      'Text from the item: the passage or comment that matched, or the start of the item when only its title matched. Empty when the item has no text.',
    example: 'Deploys go through the GitOps repository. Merge to main and ...',
  })
  excerpt!: string;

  @ApiProperty({
    description:
      "True when the excerpt is the item's whole text (or the whole comment). False when it is only a part.",
    example: false,
  })
  excerptIsComplete!: boolean;

  @ApiPropertyOptional({
    type: String,
    description: 'ID of the comment the excerpt comes from. Null unless a comment matched.',
    example: null,
    nullable: true,
  })
  commentId!: string | null;

  @ApiPropertyOptional({
    type: String,
    description: 'Who wrote the matching comment. Null unless a comment matched.',
    example: null,
    nullable: true,
  })
  commentAuthor!: string | null;
}
