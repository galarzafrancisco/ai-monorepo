import { IsString, IsNotEmpty, IsUrl } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateArtefactDto {
  @ApiProperty({
    description: 'Name of the artefact',
    example: 'Pull Request #123',
  })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiProperty({
    description: 'Link to the artefact',
    example: 'https://github.com/owner/repo/pull/123',
  })
  @IsUrl()
  @IsNotEmpty()
  link!: string;
}
