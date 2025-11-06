import { ApiProperty } from '@nestjs/swagger';

export class DeleteConnectionResponseDto {
  @ApiProperty({
    description: 'Confirmation message indicating the connection was deleted',
    example: 'Connection deleted successfully',
  })
  message!: string;
}
