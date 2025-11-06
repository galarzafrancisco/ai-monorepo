import { ApiProperty } from '@nestjs/swagger';

export class DeleteServerResponseDto {
  @ApiProperty({
    description: 'Confirmation message indicating the server was deleted',
    example: 'Server deleted successfully',
  })
  message!: string;
}
