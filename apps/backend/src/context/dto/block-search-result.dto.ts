import { ApiProperty } from '@nestjs/swagger';

export class BlockSearchResultDto {
  @ApiProperty({
    description: 'Block ID',
    example: 'ba1cffdd-6c42-4cfc-ab00-ba1cf934fb81',
  })
  id!: string;

  @ApiProperty({
    description: 'Block title',
    example: 'Authentication Guide',
  })
  title!: string;

  @ApiProperty({
    description: 'Match confidence score (0-1, higher is better)',
    example: 0.85,
    minimum: 0,
    maximum: 1,
  })
  score!: number;
}
