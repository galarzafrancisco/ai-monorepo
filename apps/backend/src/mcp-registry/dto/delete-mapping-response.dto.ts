import { ApiProperty } from '@nestjs/swagger';

export class DeleteMappingResponseDto {
  @ApiProperty({
    description: 'Confirmation message indicating the mapping was deleted',
    example: 'Mapping deleted successfully',
  })
  message!: string;
}
