import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { AccessRequestStatus } from '../../enums';

export class ListAccessRequestsQueryDto {
  @ApiPropertyOptional({ enum: AccessRequestStatus, enumName: 'AccessRequestStatus' })
  @IsOptional()
  @IsEnum(AccessRequestStatus)
  status?: AccessRequestStatus;

  @ApiPropertyOptional({ description: 'Matches email or answer (case-insensitive)', maxLength: 100 })
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(100)
  search?: string;

  @ApiPropertyOptional({ default: 50, minimum: 1, maximum: 200 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number;

  @ApiPropertyOptional({ default: 0, minimum: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number;
}

export class UpdateAccessRequestDto {
  @ApiProperty({ enum: AccessRequestStatus, enumName: 'AccessRequestStatus' })
  @IsEnum(AccessRequestStatus)
  status!: AccessRequestStatus;
}

export class AccessRequestResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() email!: string;
  @ApiProperty({ nullable: true, type: String }) building!: string | null;
  @ApiProperty({ enum: AccessRequestStatus, enumName: 'AccessRequestStatus' }) status!: AccessRequestStatus;
  @ApiProperty() submissionCount!: number;
  @ApiProperty({ format: 'date-time' }) createdAt!: string;
  @ApiProperty({ format: 'date-time' }) lastSubmittedAt!: string;
  @ApiProperty({ nullable: true, type: String, format: 'date-time' }) reviewedAt!: string | null;
}

export class AccessRequestListResponseDto {
  @ApiProperty({ type: [AccessRequestResponseDto] }) items!: AccessRequestResponseDto[];
  @ApiProperty() total!: number;
}
