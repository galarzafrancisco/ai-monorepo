import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ActorType } from '../enums';

export class ActorResponseDto {
  @ApiProperty({
    description: 'Unique identifier for the actor',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  id!: string;

  @ApiProperty({
    description: 'Type of the actor',
    enum: ActorType,
    example: ActorType.HUMAN,
  })
  type!: ActorType;

  @ApiProperty({
    description: 'Unique slug identifier for the actor',
    example: 'john@example.com',
  })
  slug!: string;

  @ApiProperty({
    description: 'Display name of the actor',
    example: 'John Doe',
  })
  displayName!: string;

  @ApiPropertyOptional({
    description: 'URL to the actor avatar image',
    example: 'https://example.com/avatar.png',
    nullable: true,
  })
  avatarUrl!: string | null;
}
