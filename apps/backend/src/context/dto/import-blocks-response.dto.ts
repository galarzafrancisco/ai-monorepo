import { ApiProperty } from '@nestjs/swagger';

export class ImportBlocksResponseDto {
  @ApiProperty({
    description: 'Number of context blocks imported from the archive',
    example: 12,
  })
  importedCount!: number;
}
