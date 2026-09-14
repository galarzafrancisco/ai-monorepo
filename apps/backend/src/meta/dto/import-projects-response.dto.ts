import { ApiProperty } from '@nestjs/swagger';

export class ImportProjectsResponseDto {
  @ApiProperty({ example: 3 })
  importedCount!: number;
}
