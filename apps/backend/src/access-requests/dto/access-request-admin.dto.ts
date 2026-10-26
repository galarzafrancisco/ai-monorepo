import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export const ACCESS_REQUEST_STATUSES = ['new', 'reviewed'] as const;

export class ListAccessRequestsQueryDto {
  @ApiPropertyOptional({ enum: ACCESS_REQUEST_STATUSES })
  @IsOptional()
  @IsIn(ACCESS_REQUEST_STATUSES)
  status?: 'new' | 'reviewed';

  @ApiPropertyOptional({ description: 'Matches email or description (case-insensitive)' })
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(100)
  search?: string;

  @ApiPropertyOptional({ default: 50, maximum: 200 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number;
}

export class UpdateAccessRequestDto {
  @ApiProperty({ enum: ACCESS_REQUEST_STATUSES })
  @IsIn(ACCESS_REQUEST_STATUSES)
  status!: 'new' | 'reviewed';
}

export class AccessRequestResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() email!: string;
  @ApiProperty({ nullable: true, type: String }) building!: string | null;
  @ApiProperty({ enum: ACCESS_REQUEST_STATUSES }) status!: 'new' | 'reviewed';
  @ApiProperty() submissionCount!: number;
  @ApiProperty() createdAt!: string;
  @ApiProperty() lastSubmittedAt!: string;
  @ApiProperty({ nullable: true, type: String }) reviewedAt!: string | null;
}

export class AccessRequestListResponseDto {
  @ApiProperty({ type: [AccessRequestResponseDto] }) items!: AccessRequestResponseDto[];
  @ApiProperty() total!: number;
}
