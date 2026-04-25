import { ApiProperty } from '@nestjs/swagger';
import { AgentType } from 'src/agents/enums';

export class WorkerResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty()
  oauthClientId!: string;

  @ApiProperty({ type: String, nullable: true, example: '0.2.16' })
  workerVersion!: string | null;

  @ApiProperty({ format: 'date-time' })
  lastSeenAt!: string;

  @ApiProperty({ enum: AgentType, isArray: true })
  harnesses!: AgentType[];

  @ApiProperty({ format: 'date-time' })
  createdAt!: string;

  @ApiProperty({ format: 'date-time' })
  updatedAt!: string;
}
