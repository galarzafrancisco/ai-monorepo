import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class AgentToolPermissionParamsDto {
  @ApiProperty({
    description: 'MCP server UUID used by this assignment',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsUUID()
  serverId!: string;
}
