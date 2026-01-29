import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsOptional,
  IsString,
  MaxLength,
  IsArray,
  IsUUID,
  IsInt,
  Min,
  ValidateIf,
} from 'class-validator';

export class UpdateBlockDto {
  @ApiPropertyOptional({
    description: 'Updated title of the context block',
    example: 'Updated onboarding guide',
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  title?: string;

  @ApiPropertyOptional({
    description: 'Updated markdown content of the block',
    example: '## Updated content',
  })
  @IsOptional()
  @IsString()
  content?: string;

  @ApiPropertyOptional({
    description: 'Array of tag names to associate with the block',
    example: ['documentation', 'onboarding'],
    type: [String],
  })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  tagNames?: string[];

  @ApiPropertyOptional({
    description: 'Parent block ID (null to remove parent)',
    example: '123e4567-e89b-12d3-a456-426614174000',
    type: String,
    nullable: true,
  })
  @IsOptional()
  @ValidateIf((o) => o.parentId !== null)
  @IsUUID('4', { message: 'Parent ID must be a valid UUID' })
  parentId?: string | null;

  @ApiPropertyOptional({
    description: 'Order within siblings',
    example: 0,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  order?: number;
}
