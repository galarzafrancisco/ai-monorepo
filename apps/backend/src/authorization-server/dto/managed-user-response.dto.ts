import { ApiProperty } from '@nestjs/swagger';
import { UserRole } from 'src/identity-provider/enums';

export class ManagedUserResponseDto {
  @ApiProperty({ description: 'User ID' })
  id!: string;

  @ApiProperty({ description: 'User email address' })
  email!: string;

  @ApiProperty({ description: 'Display name from the associated human actor' })
  displayName!: string;

  @ApiProperty({ description: 'Actor slug/username' })
  slug!: string;

  @ApiProperty({ description: 'Actor ID associated with this user' })
  actorId!: string;

  @ApiProperty({ description: 'User role', enum: UserRole })
  role!: UserRole;

  @ApiProperty({ description: 'Whether this user can currently sign in' })
  isActive!: boolean;

  @ApiProperty({ description: 'Whether this user still needs to set a password' })
  passwordSetupPending!: boolean;

  @ApiProperty({ description: 'Creation timestamp' })
  createdAt!: Date;

  @ApiProperty({ description: 'Last update timestamp' })
  updatedAt!: Date;
}
