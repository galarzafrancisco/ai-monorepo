import { ApiProperty } from '@nestjs/swagger';
import { ContextBlockSummaryResult } from './service/threads.service.types';

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

  /**
   * Factory method to create a ContextBlockSummaryResponseDto from a result.
   * Centralizes mapping logic from service layer result to wire DTO.
   */
  static fromResult(result: ContextBlockSummaryResult): ContextBlockSummaryResponseDto {
    return {
      id: result.id,
      title: result.title,
    };
  }
}
