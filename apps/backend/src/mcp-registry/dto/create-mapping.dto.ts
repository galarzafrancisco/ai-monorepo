import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsUUID, MaxLength } from 'class-validator';

export class CreateMappingDto {
  @ApiProperty({
    description: 'MCP scope ID to map from',
    example: 'tool:read',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  scopeId!: string;

  @ApiProperty({
    description: 'Connection ID that owns this mapping',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsUUID()
  @IsNotEmpty()
  connectionId!: string;

  @ApiProperty({
    description: 'Downstream OAuth scope string',
    example: 'repo:read',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  downstreamScope!: string;
}
