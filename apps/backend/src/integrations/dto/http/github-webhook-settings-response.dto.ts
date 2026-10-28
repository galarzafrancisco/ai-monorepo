import { ApiProperty } from '@nestjs/swagger';

export class GithubWebhookSourceDto {
  @ApiProperty({ example: 'acme' })
  owner!: string;

  @ApiProperty({
    type: String,
    nullable: true,
    description: 'The repository, or null when the webhook covers every repository of the owner (organization or GitHub App webhook)',
    example: 'api',
  })
  repo!: string | null;

  @ApiProperty({ example: '2026-01-01T00:00:00.000Z' })
  lastDeliveryAt!: string;

  @ApiProperty({
    type: String,
    nullable: true,
    description: 'Event of the last delivery; ping right after the webhook is set up',
    example: 'pull_request',
  })
  lastEvent!: string | null;

  @ApiProperty({
    description: 'Delivered in the last day: Taico counts on the webhook and polls this repository less',
    example: true,
  })
  active!: boolean;
}

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

  @ApiProperty({
    type: [GithubWebhookSourceDto],
    description: 'Repositories (or whole owners) deliveries came from, most recent first. Learned from the deliveries.',
  })
  sources!: GithubWebhookSourceDto[];
}
