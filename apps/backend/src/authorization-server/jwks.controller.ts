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
  async getJwks() {
    const jwks = await this.jwksService.getPublicKeys();

    return {
      keys: jwks.map((key) => ({
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

  @Get('jwk-active.json')
  @ApiOperation({
    summary: 'Get Active Signing Key (Single JWK)',
    description:
      'Returns the currently active signing key as a single JWK. Useful for debugging and testing JWT verification with tools like jwt.io. This endpoint returns only the current signing key, not the full key set.',
  })
  @ApiOkResponse({
    description: 'Active JWK retrieved successfully',
  })
  async getActiveJwk() {
    const jwks = await this.jwksService.getPublicKeys();
    const activeSigningKey = await this.jwksService.getActiveSigningKey();

    // Find the active key in the JWKS
    const activeJwk = jwks.find((key) => key.kid === activeSigningKey.kid);

    if (!activeJwk) {
      throw new Error('Active signing key not found in JWKS');
    }

    return {
      kty: activeJwk.kty,
      use: activeJwk.use,
      kid: activeJwk.kid,
      alg: activeJwk.alg,
      n: activeJwk.n,
      e: activeJwk.e,
      x: activeJwk.x,
      y: activeJwk.y,
      crv: activeJwk.crv,
    };
  }
}
