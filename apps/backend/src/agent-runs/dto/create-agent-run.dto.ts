import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsUUID, IsOptional } from 'class-validator';

export class CreateAgentRunDto {
  @ApiProperty({
    description: 'UUID of the parent task being executed',
    example: '123e4567-e89b-12d3-a456-426614174001',
  })
  @IsNotEmpty()
  @IsUUID()
  parentTaskId!: string;

  @ApiPropertyOptional({
    description:
      'UUID of the associated TaskExecution (for new execution-centric paths)',
    example: '123e4567-e89b-12d3-a456-426614174002',
    nullable: true,
  })
  @IsOptional()
  @IsUUID()
  taskExecutionId?: string;
}
