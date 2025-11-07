import { IsString, IsNotEmpty, IsBoolean } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * User consent decision DTO for authorization flow
 */
export class ConsentDecisionDto {
  @ApiProperty({
    description: 'Authorization flow ID (serves as CSRF protection token)',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsString()
  @IsNotEmpty()
  flow_id!: string;

  @ApiProperty({
    description: 'Whether the user approved the authorization request',
    example: true,
  })
  @IsBoolean()
  approved!: boolean;
}
