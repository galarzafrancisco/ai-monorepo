import { ApiProperty } from '@nestjs/swagger';

export class AccountSetupStatusResponseDto {
  @ApiProperty({ description: 'Normalized email address' })
  email!: string;

  @ApiProperty({ description: 'Whether an invited or reset account can be set up' })
  canSetup!: boolean;
}
