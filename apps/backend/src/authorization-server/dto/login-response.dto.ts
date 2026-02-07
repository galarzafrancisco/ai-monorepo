import { ApiProperty } from '@nestjs/swagger';
import { UserResponseDto } from './user-response.dto';

export class LoginResponseDto {
  @ApiProperty({
    description: 'Authenticated user information',
    type: UserResponseDto,
    example: {
      id: '123e4567-e89b-12d3-a456-426614174000',
      email: 'user@example.com',
      displayName: 'John Doe',
      role: 'standard',
      actorId: '123e4567-e89b-12d3-a456-426614174000',
    },
  })
  user!: UserResponseDto;

  @ApiProperty({
    description: 'Access token expiration time in seconds',
    example: 600,
  })
  expiresIn!: number;
}
