import { ApiProperty } from '@nestjs/swagger';

export class VersionResponseDto {
  @ApiProperty({
    description: 'Backend version',
    example: '0.2.16',
  })
  backend!: string;

  @ApiProperty({
    description: 'UI version',
    example: '0.2.16',
  })
  ui!: string;
}
