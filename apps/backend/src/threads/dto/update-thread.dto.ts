import { IsString, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateThreadDto {
  @ApiPropertyOptional({
    description: 'Updated title of the thread',
    example: 'Updated authentication feature implementation',
  })
  @IsString()
  @IsOptional()
  title?: string;
}
