import { ApiProperty } from '@nestjs/swagger';

export class UserDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  email: string;

  @ApiProperty()
  displayName: string;
}

export class SessionResponseDto {
  @ApiProperty()
  user: UserDto;
}
