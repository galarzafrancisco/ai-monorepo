import { ApiProperty } from '@nestjs/swagger';

export class ContextBlockSummaryResponseDto {
  @ApiProperty({
    description: 'Context block ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  id!: string;

  @ApiProperty({
    description: 'Context block title',
    example: 'API Design Documentation',
  })
  title!: string;
}
