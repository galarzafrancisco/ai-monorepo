import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateThreadStateDto {
  @ApiProperty({
    description: 'New content for the thread state',
    example: 'This thread is now focused on implementing the authentication feature.',
  })
  @IsString()
  @IsNotEmpty()
  content!: string;
}
