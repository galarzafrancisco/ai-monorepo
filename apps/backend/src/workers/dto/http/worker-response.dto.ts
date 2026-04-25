import { ApiProperty } from '@nestjs/swagger';
import { AgentType } from 'src/agents/enums';

export class WorkerResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty()
  oauthClientId!: string;

  @ApiProperty({ format: 'date-time' })
  lastSeenAt!: string;

  @ApiProperty({ enum: AgentType, isArray: true })
  harnesses!: AgentType[];

  @ApiProperty({ format: 'date-time' })
  createdAt!: string;

  @ApiProperty({ format: 'date-time' })
  updatedAt!: string;
}
