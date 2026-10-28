import { ApiProperty } from '@nestjs/swagger';

export class GithubWebhookSettingsResponseDto {
  @ApiProperty({
    description: 'Payload URL to enter in GitHub (repository, organization or app webhook settings)',
    example: 'https://taico.example.com/api/v1/integrations/github/webhooks/123e4567-e89b-12d3-a456-426614174000',
  })
  url!: string;

  @ApiProperty({ description: 'Secret to enter in GitHub. GitHub signs every delivery with it.', example: '5f2c…' })
  secret!: string;

  @ApiProperty({ type: String, nullable: true, description: 'When the last correctly signed delivery arrived', example: null })
  lastDeliveryAt!: string | null;
}
