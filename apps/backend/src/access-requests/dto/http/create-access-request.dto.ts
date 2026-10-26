import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEmail, IsOptional, IsString, MaxLength } from 'class-validator';
import { ACCESS_REQUEST_BUILDING_MAX, ACCESS_REQUEST_EMAIL_MAX } from '../../access-request.limits';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export class CreateAccessRequestDto {
  @ApiProperty({ example: 'you@company.dev', maxLength: ACCESS_REQUEST_EMAIL_MAX })
  @Transform(trim)
  @IsEmail()
  @MaxLength(ACCESS_REQUEST_EMAIL_MAX)
  email!: string;

  @ApiPropertyOptional({ maxLength: ACCESS_REQUEST_BUILDING_MAX, description: 'What are you building with agents?' })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(ACCESS_REQUEST_BUILDING_MAX)
  building?: string;

  /** Honeypot: hidden in the UI. Real people leave it empty. */
  @ApiPropertyOptional({ description: 'Leave empty.', maxLength: 200 })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  website?: string;
}

export class CreateAccessRequestResponseDto {
  @ApiProperty({ example: true })
  received!: boolean;
}
