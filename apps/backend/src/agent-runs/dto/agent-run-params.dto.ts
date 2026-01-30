import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class AgentRunParamsDto {
  @ApiProperty({
    description: 'Agent run ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsUUID()
  runId!: string;
}
