import { ApiProperty } from '@nestjs/swagger';
import { ArtefactEntity } from '../artefact.entity';
import { ArtefactResult } from './service/tasks.service.types';

export class ArtefactResponseDto {
  @ApiProperty({
    description: 'Unique identifier for the artefact',
    example: '123e4567-e89b-12d3-a456-426614174001',
  })
  id!: string;

  @ApiProperty({
    description: 'ID of the task this artefact belongs to',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  taskId!: string;

  @ApiProperty({
    description: 'Name of the artefact',
    example: 'Pull Request',
  })
  name!: string;

  @ApiProperty({
    description: 'Link to the artefact',
    example: 'https://github.com/owner/repo/pull/123',
  })
  link!: string;

  @ApiProperty({
    description: 'Artefact creation timestamp',
    example: '2025-11-03T10:30:00.000Z',
  })
  createdAt!: string;

  /**
   * Factory method to create an ArtefactResponseDto from an ArtefactEntity.
   * Used by the WebSocket gateway to map domain entities to wire DTOs.
   */
  static fromEntity(artefact: ArtefactEntity): ArtefactResponseDto {
    return {
      id: artefact.id,
      taskId: artefact.taskId,
      name: artefact.name,
      link: artefact.link,
      createdAt: artefact.createdAt.toISOString(),
    };
  }

  /**
   * Factory method to create an ArtefactResponseDto from an ArtefactResult.
   * Centralizes mapping logic from service layer result to wire DTO.
   */
  static fromResult(result: ArtefactResult): ArtefactResponseDto {
    return {
      id: result.id,
      taskId: result.taskId,
      name: result.name,
      link: result.link,
      createdAt: result.createdAt.toISOString(),
    };
  }
}
