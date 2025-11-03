import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateTaskDto {
  @ApiProperty({
    description: 'Updated description of the task',
    example: 'Add JWT-based authentication with refresh tokens',
  })
  @IsString()
  @IsNotEmpty()
  description!: string;
}
