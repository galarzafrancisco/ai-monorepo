import { ApiProperty } from '@nestjs/swagger';

export class AgentExecutionTokenResponseDto {
  @ApiProperty({
    description: 'The raw short-lived JWT execution token for the agent.',
    example: 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...',
  })
  token!: string;

  @ApiProperty({
    description: 'Scopes granted to this token.',
    example: ['tasks:read', 'tasks:write'],
    type: [String],
  })
  scopes!: string[];

  @ApiProperty({
    description: 'When this token expires (ISO 8601).',
    example: '2026-03-27T08:30:00.000Z',
  })
  expiresAt!: string;

  @ApiProperty({
    description: 'Agent slug this token acts as.',
    example: 'claude-dev',
  })
  agentSlug!: string;

  @ApiProperty({
    description: 'Client identifier of the caller that requested the token.',
    example: 'worker-client',
  })
  requestedByClientId!: string;
}
