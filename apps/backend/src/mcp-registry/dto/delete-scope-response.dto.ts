import { ApiProperty } from '@nestjs/swagger';

export class DeleteScopeResponseDto {
  @ApiProperty({
    description: 'Confirmation message indicating the scope was deleted',
    example: 'Scope deleted successfully',
  })
  message!: string;
}
