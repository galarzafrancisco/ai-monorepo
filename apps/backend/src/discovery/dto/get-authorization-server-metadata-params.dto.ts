import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class GetAuthorizationServerMetadataParamsDto {
  @ApiProperty({
    name: 'mcpServerId',
    description: 'MCP server UUID or provided identifier registered in the catalog.',
    example: 'inventory-service',
  })
  @IsString()
  @IsNotEmpty()
  mcpServerId!: string;

  @ApiProperty({
    name: 'version',
    description: 'Semantic version for the MCP server configuration.',
    example: 'v1',
  })
  @IsString()
  @IsNotEmpty()
  version!: string;
}
