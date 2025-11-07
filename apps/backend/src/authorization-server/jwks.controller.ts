import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwksService, JWKS } from './jwks.service';

@ApiTags('JWKS')
@Controller('.well-known')
export class JwksController {
  constructor(private readonly jwksService: JwksService) {}

  @Get('jwks.json')
  @ApiOperation({
    summary: 'Get JSON Web Key Set (JWKS)',
    description:
      'Returns the public keys used to verify JWT signatures. This endpoint provides all valid (non-expired) keys to support key rotation.',
  })
  @ApiOkResponse({
    description: 'JWKS retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        keys: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              kty: { type: 'string', example: 'RSA' },
              use: { type: 'string', example: 'sig' },
              kid: { type: 'string', example: '1234567890abcdef' },
              alg: { type: 'string', example: 'RS256' },
              n: { type: 'string' },
              e: { type: 'string' },
            },
          },
        },
      },
    },
  })
  async getJwks(): Promise<JWKS> {
    return this.jwksService.getPublicKeys();
  }
}
