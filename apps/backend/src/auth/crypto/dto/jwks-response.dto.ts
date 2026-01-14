import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class JwkResponseDto {
  @ApiProperty({
    description: 'Key type, for example RSA or EC.',
    example: 'RSA',
  })
  kty!: string;

  @ApiProperty({
    description: 'Key usage indicating how the key can be used.',
    example: 'sig',
  })
  use!: string;

  @ApiProperty({
    description: 'Unique identifier for the key used for rotation.',
    example: '1234567890abcdef',
  })
  kid!: string;

  @ApiProperty({
    description: 'Algorithm intended for use with this key.',
    example: 'RS256',
  })
  alg!: string;

  @ApiPropertyOptional({
    description: 'RSA modulus encoded using base64url.',
    example: 'xGOr-H7A...',
  })
  n?: string;

  @ApiPropertyOptional({
    description: 'RSA public exponent encoded using base64url.',
    example: 'AQAB',
  })
  e?: string;

  @ApiPropertyOptional({
    description: 'Public coordinate X for EC keys encoded using base64url.',
    example: 'WKn-ZIGevcwGIyyrzFoZNBdaq9_TsqzGl96oc0CWuis',
  })
  x?: string;

  @ApiPropertyOptional({
    description: 'Public coordinate Y for EC keys encoded using base64url.',
    example: 'y77t-RvAHRKTsSGdIYUfweuOvwrvDD-Q3Hv5J0fSKbE',
  })
  y?: string;

  @ApiPropertyOptional({
    description: 'Curve name for EC keys.',
    example: 'P-256',
  })
  crv?: string;
}

export class JwksResponseDto {
  @ApiProperty({
    description: 'Collection of JSON Web Keys currently valid for signature verification.',
    type: [JwkResponseDto],
  })
  keys!: JwkResponseDto[];
}
