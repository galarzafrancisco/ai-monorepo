import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class GetProtectedResourceMetadataParamsDto {
  @ApiProperty({
    name: 'resource',
    description: 'Path of the endpoint this resource exposes',
    example: '/api/v1/taskeroo/tasks',
  })
  @IsString()
  @IsNotEmpty()
  resource!: string;
}
