import { ApiProperty } from '@nestjs/swagger';
import { IsInt, Min } from 'class-validator';

export class ReorderPageDto {
  @ApiProperty({
    description: 'New order position within siblings',
    example: 2,
  })
  @IsInt()
  @Min(0)
  newOrder!: number;
}
