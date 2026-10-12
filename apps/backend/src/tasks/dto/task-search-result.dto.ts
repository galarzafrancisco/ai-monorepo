import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { SearchMatchField, SearchStrategy } from '../../search/enums';

export class TaskSearchResultDto {
  @ApiProperty({
    description: 'Task ID',
    example: 'ba1cffdd-6c42-4cfc-ab00-ba1cf934fb81',
  })
  id!: string;

  @ApiProperty({
    description: 'Task name/title',
    example: 'Implement authentication system',
  })
  name!: string;

  @ApiPropertyOptional({
    type: String,
    description: 'Task status',
    example: 'IN_PROGRESS',
    nullable: true,
  })
  status!: string | null;

  @ApiProperty({
    description:
      'Relevance from 0 to 1, for ordering results within this response. Not comparable between searches.',
    example: 0.85,
    minimum: 0,
    maximum: 1,
  })
  score!: number;

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
      'Which part of the task matched best: its name, its description, or one of its comments',
    enum: SearchMatchField,
    enumName: 'SearchMatchField',
    example: SearchMatchField.COMMENT,
  })
  matchedOn!: SearchMatchField;

  @ApiProperty({
    description:
      'Text from the task: the comment or part of the description that matched, or the start of the description when only the name matched. Empty when the task has no description.',
    example: 'Switched the token store to Redis; refresh tokens now rotate on every use.',
  })
  excerpt!: string;

  @ApiProperty({
    description:
      'True when the excerpt is the whole description (or the whole comment). False when it is only a part.',
    example: true,
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
