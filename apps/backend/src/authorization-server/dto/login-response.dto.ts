import { ApiProperty } from '@nestjs/swagger';
import { UserResponseDto } from './user-response.dto';

export class LoginResponseDto {
  @ApiProperty({
    description: 'Authenticated user information',
    type: UserResponseDto,
  })
  user!: UserResponseDto;

  @ApiProperty({
    description: 'Access token expiration time in seconds',
    example: 600,
  })
  expiresIn!: number;
}
