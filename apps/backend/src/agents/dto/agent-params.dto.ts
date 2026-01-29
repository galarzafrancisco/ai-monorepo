import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AgentParamsDto {
  @ApiProperty({
    description: 'Agent slug',
    examples: {
      bySlug: {
        summary: 'By slug',
        value: 'alfred',
      },
    },
  })
  @IsString()
  @IsNotEmpty()
  slug!: string;
}
