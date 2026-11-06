import { ApiProperty } from '@nestjs/swagger';
import { SearchMatchField, SearchStrategy } from '../../search/enums';

export class BlockSearchResultDto {
  @ApiProperty({
    description: 'Block ID',
    example: 'ba1cffdd-6c42-4cfc-ab00-ba1cf934fb81',
  })
  id!: string;

  @ApiProperty({
    description: 'Address of the context block in the Taico web app. Use it to link to the block.',
    example: 'https://taico.example.com/context/block/123e4567-e89b-12d3-a456-426614174000',
  })
  url!: string;

  @ApiProperty({
    description: 'Block title',
    example: 'Authentication Guide',
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
    description: 'The search strategies that found this result',
    enum: SearchStrategy,
    enumName: 'SearchStrategy',
    isArray: true,
    example: [SearchStrategy.KEYWORD, SearchStrategy.SEMANTIC],
  })
  matchedBy!: SearchStrategy[];

  @ApiProperty({
    description: 'Which part of the block matched best: its title or a passage of its content',
    enum: SearchMatchField,
    enumName: 'SearchMatchField',
    example: SearchMatchField.CONTENT,
  })
  matchedOn!: SearchMatchField;

  @ApiProperty({
    description:
      'Text from the block: the passage that matched, or the start of the content when only the title matched. Empty when the block has no content.',
    example: 'Access tokens last 15 minutes. Refresh tokens rotate on every use ...',
  })
  excerpt!: string;

  @ApiProperty({
    description:
      "True when the excerpt is the block's whole content. False when it is only a part.",
    example: false,
  })
  excerptIsComplete!: boolean;
}
