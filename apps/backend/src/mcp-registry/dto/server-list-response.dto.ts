import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';
import { ServerResponseDto } from './server-response.dto';

export class ServerListResponseDto {
  @ApiProperty({
    description: 'List of MCP servers',
    type: [ServerResponseDto],
  })
  @ValidateNested({ each: true })
  @Type(() => ServerResponseDto)
  items!: ServerResponseDto[];
}
