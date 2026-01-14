import { Module } from '@nestjs/common';
import { AccessTokenValidationService } from './validation/access-token-validation.service';
import { AccessTokenGuard } from './guards/access-token.guard';
import { AuthCryptoModule } from '../crypto/auth-crypto.module';

@Module({
  imports: [
    AuthCryptoModule,
  ],
  providers: [
    AccessTokenValidationService,
    AccessTokenGuard,
  ],
  controllers: [],
  exports: [
    AccessTokenValidationService,
  ],
})
export class AuthGuardsModule {}
