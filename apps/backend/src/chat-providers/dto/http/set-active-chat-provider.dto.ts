import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsUUID } from 'class-validator';

export class SetActiveChatProviderDto {
  @ApiProperty({
    description: 'ID of the chat provider to set as active',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsUUID()
  @IsNotEmpty()
  providerId!: string;
}
