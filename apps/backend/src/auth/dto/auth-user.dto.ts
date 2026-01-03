import { ApiProperty } from '@nestjs/swagger';

export class AuthUserDto {
  @ApiProperty({
    description: 'User ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  id!: string;

  @ApiProperty({
    description: 'User email address',
    example: 'user@example.com',
  })
  email!: string;

  @ApiProperty({
    description: 'User display name',
    example: 'John Doe',
  })
  displayName!: string;

  @ApiProperty({
    description: 'User role',
    enum: ['admin', 'standard'],
    example: 'standard',
  })
  role!: 'admin' | 'standard';
}
