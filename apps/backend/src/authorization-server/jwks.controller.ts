import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwksService } from './jwks.service';
import { JwksResponseDto } from './dto/jwks-response.dto';

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
    type: JwksResponseDto,
  })
  async getJwks(): Promise<JwksResponseDto> {
    const jwks = await this.jwksService.getPublicKeys();

    return {
      keys: jwks.keys.map((key) => ({
        kty: key.kty,
        use: key.use,
        kid: key.kid,
        alg: key.alg,
        n: key.n,
        e: key.e,
        x: key.x,
        y: key.y,
        crv: key.crv,
      })),
    };
  }
}
