import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class AddTagDto {
  @ApiProperty({
    description: 'Name of the tag',
    example: 'project-alpha',
  })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiPropertyOptional({
    description: 'Color for the tag (hex format)',
    example: '#FF5733',
  })
  @IsString()
  @IsOptional()
  color?: string;

  @ApiPropertyOptional({
    description: 'Description of the tag',
    example: 'Notes related to project alpha',
  })
  @IsString()
  @IsOptional()
  description?: string;
}
