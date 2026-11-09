import { ApiProperty } from '@nestjs/swagger';
import { ManagedUserResponseDto } from './managed-user-response.dto';

/**
 * A created or reset user, with the one-time code that sets up its password.
 * Shown once: hand the link to the person, by a channel you trust.
 */
export class ManagedUserSetupResponseDto extends ManagedUserResponseDto {
  @ApiProperty({ description: 'One-time setup code. Shown once.' })
  setupCode!: string;

  @ApiProperty({ description: 'Link that opens account setup with the code filled in. Shown once.' })
  setupUrl!: string;

  @ApiProperty({ description: 'When the setup code stops working' })
  setupCodeExpiresAt!: Date;
}
