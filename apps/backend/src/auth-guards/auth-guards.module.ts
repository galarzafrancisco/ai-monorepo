import { Module, forwardRef } from '@nestjs/common';
import { AuthorizationServerModule } from 'src/authorization-server/authorization-server.module';
import { AccessTokenValidationService } from './validation/access-token-validation.service';
import { AccessTokenGuard } from './guards/access-token.guard';

@Module({
  imports: [
    forwardRef(() => AuthorizationServerModule), // Needs TokenService for validation
  ],
  providers: [
    AccessTokenValidationService,
    AccessTokenGuard,
  ],
  exports: [
    AccessTokenValidationService,
    AccessTokenGuard,
  ],
})
export class AuthGuardsModule {}
