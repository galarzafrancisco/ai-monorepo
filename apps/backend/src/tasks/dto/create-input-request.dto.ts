import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsUUID, IsNotEmpty, IsOptional } from 'class-validator';

export class CreateInputRequestDto {
  @ApiProperty({
    description:
      'ID of the actor assigned to answer the question. Defaults to task creator if not provided.',
    example: '123e4567-e89b-12d3-a456-426614174003',
    required: false,
  })
  @IsUUID()
  @IsOptional()
  assignedToActorId?: string;

  @ApiProperty({
    description: 'The question being asked',
    example: 'Should we use OAuth or JWT for authentication?',
  })
  @IsString()
  @IsNotEmpty()
  question!: string;
}
