import { ApiProperty } from '@nestjs/swagger';
import {
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export class UpdateExecutionStatsDto {
  @ApiProperty({
    type: String,
    required: false,
    nullable: true,
    description: 'Harness used by the worker to run this execution',
    example: 'opencode',
    maxLength: 50,
  })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  harness?: string | null;

  @ApiProperty({
    type: String,
    required: false,
    nullable: true,
    description: 'Model provider id used by the harness',
    example: 'openai',
    maxLength: 100,
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  providerId?: string | null;

  @ApiProperty({
    type: String,
    required: false,
    nullable: true,
    description: 'Model id used by the harness',
    example: 'gpt-5.4',
    maxLength: 255,
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  modelId?: string | null;

  @ApiProperty({
    type: String,
    required: false,
    nullable: true,
    description: 'Taico worker package version used for this execution',
    example: '0.2.16',
    maxLength: 100,
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  workerVersion?: string | null;

  @ApiProperty({
    type: Number,
    required: false,
    nullable: true,
    description: 'Input token usage when available',
    example: 1200,
    minimum: 0,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  inputTokens?: number | null;

  @ApiProperty({
    type: Number,
    required: false,
    nullable: true,
    description: 'Output token usage when available',
    example: 380,
    minimum: 0,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  outputTokens?: number | null;

  @ApiProperty({
    type: Number,
    required: false,
    nullable: true,
    description: 'Total token usage when available',
    example: 1580,
    minimum: 0,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  totalTokens?: number | null;
}
