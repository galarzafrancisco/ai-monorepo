import { Module } from '@nestjs/common';
import { AccessTokenValidationService } from './validation/access-token-validation.service';
import { AuthorizationServerModule } from 'src/authorization-server/authorization-server.module';
import { AccessTokenGuard } from './guards/access-token.guard';

@Module({
  imports: [
    AuthorizationServerModule
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
export class AuthModule {}
