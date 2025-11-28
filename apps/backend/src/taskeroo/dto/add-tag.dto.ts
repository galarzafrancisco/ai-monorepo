import { IsString, IsNotEmpty, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AddTagDto {
  @ApiProperty({
    description: 'Name of the tag',
    example: 'bug',
  })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiPropertyOptional({
    description: 'Color for the tag (hex format). If not provided, a random color will be assigned.',
    example: '#FF5733',
  })
  @IsString()
  @IsOptional()
  color?: string;
}
