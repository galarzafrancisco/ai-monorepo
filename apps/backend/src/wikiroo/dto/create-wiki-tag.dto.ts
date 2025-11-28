import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateWikiTagDto {
  @ApiProperty({
    description: 'Name of the tag',
    example: 'project-alpha',
  })
  @IsString()
  @IsNotEmpty()
  name!: string;
}
