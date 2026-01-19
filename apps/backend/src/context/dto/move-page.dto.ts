import { ApiProperty } from '@nestjs/swagger';
import { IsUUID, IsOptional } from 'class-validator';

export class MovePageDto {
  @ApiProperty({
    description: 'New parent page ID (null to move to root)',
    example: '123e4567-e89b-12d3-a456-426614174000',
    nullable: true,
  })
  @IsOptional()
  @IsUUID()
  newParentId!: string | null;
}
