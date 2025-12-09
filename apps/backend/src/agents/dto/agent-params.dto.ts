import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AgentParamsDto {
  @ApiProperty({
    description: 'Agent ID or slug',
    examples: {
      bySlug: {
        summary: 'By slug',
        value: 'alfred',
      },
      byId: {
        summary: 'By ID',
        value: '123e4567-e89b-12d3-a456-426614174000',
      },
    },
  })
  @IsString()
  @IsNotEmpty()
  id!: string;
}
