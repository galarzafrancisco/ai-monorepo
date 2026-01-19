import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateTagDto {
  @ApiProperty({
    description: 'Name of the tag',
    example: 'bug',
  })
  @IsString()
  @IsNotEmpty()
  name!: string;
}
