import { Global, Logger, Module } from '@nestjs/common';
import { ResourceServer } from '@taico/auth';
import { AUTH_RESOURCE_SERVER } from '@taico/auth/nest';
import { getConfig } from 'src/config/env.config';
import { COOKIE_KEYS } from '../core/constants';
import { taicoAudiencePolicy } from '../core/resource-audience';
import { AuthCryptoModule } from '../crypto/auth-crypto.module';
import { TokenVerifierService } from '../crypto/token-verifier.service';
import { AccessTokenValidationService } from './validation/access-token-validation.service';

/**
 * Configures how Taico verifies requests: the `@taico/auth` guards
 * (AccessTokenGuard, ScopesGuard and their websocket counterparts) resolve
 * the ResourceServer provided here. Global, so a module only has to put the
 * guards on its controllers.
 */
@Global()
@Module({
  imports: [AuthCryptoModule],
  providers: [
    AccessTokenValidationService,
    {
      provide: AUTH_RESOURCE_SERVER,
      inject: [TokenVerifierService],
      useFactory: (tokenVerifierService: TokenVerifierService) =>
        new ResourceServer({
          verifier: tokenVerifierService.verifier,
          audience: taicoAudiencePolicy(),
          // Request URLs are built from the public URL, not the Host header
          baseUrl: getConfig().issuerUrl,
          cookieName: COOKIE_KEYS.ACCESS_TOKEN,
          logger: new Logger('ResourceServer'),
        }),
    },
  ],
  exports: [AccessTokenValidationService, AUTH_RESOURCE_SERVER],
})
export class AuthGuardsModule {}
