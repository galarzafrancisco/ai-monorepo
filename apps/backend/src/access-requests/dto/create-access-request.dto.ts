import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEmail, IsOptional, IsString, MaxLength } from 'class-validator';

export const ACCESS_REQUEST_BUILDING_MAX = 280;

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export class CreateAccessRequestDto {
  @ApiProperty({ example: 'you@company.dev' })
  @Transform(trim)
  @IsEmail()
  @MaxLength(254)
  email!: string;

  @ApiPropertyOptional({ maxLength: ACCESS_REQUEST_BUILDING_MAX })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(ACCESS_REQUEST_BUILDING_MAX)
  building?: string;

  /** Honeypot: hidden in the UI. Real people leave it empty. */
  @ApiPropertyOptional({ description: 'Leave empty.' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  website?: string;
}

export class CreateAccessRequestResponseDto {
  @ApiProperty({ example: true })
  received!: boolean;
}
