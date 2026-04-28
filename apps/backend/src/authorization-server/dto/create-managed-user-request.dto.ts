import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsEnum } from 'class-validator';
import { UserRole } from 'src/identity-provider/enums';

export class CreateManagedUserRequestDto {
  @ApiProperty({ description: 'Email address to invite', example: 'user@example.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({ description: 'Role for the new user', enum: UserRole, example: UserRole.STANDARD })
  @IsEnum(UserRole)
  role!: UserRole;
}
