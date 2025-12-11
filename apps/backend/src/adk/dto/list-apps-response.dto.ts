import { ApiProperty } from '@nestjs/swagger';

export class ListAppsResponseDto {
  @ApiProperty({
    description: 'List of available ADK app names',
    example: ['buddy', 'taskeroo-agent'],
    type: [String],
  })
  apps!: string[];
}
