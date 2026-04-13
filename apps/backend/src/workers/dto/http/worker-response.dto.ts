import { ApiProperty } from '@nestjs/swagger';
import { AgentType } from 'src/agents/enums';
import { WorkerEntity } from '../../worker.entity';

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

  static fromEntity(entity: WorkerEntity): WorkerResponseDto {
    return {
      id: entity.id,
      oauthClientId: entity.oauthClientId,
      lastSeenAt: entity.lastSeenAt.toISOString(),
      harnesses: entity.harnesses,
      createdAt: entity.createdAt.toISOString(),
      updatedAt: entity.updatedAt.toISOString(),
    };
  }
}
