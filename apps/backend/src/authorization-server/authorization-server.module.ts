import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ClientRegistrationService } from './client-registration.service';
import { ClientRegistrationController } from './client-registration.controller';
import { AuthorizationService } from './authorization.service';
import { AuthorizationController } from './authorization.controller';
import { TokenService } from './token.service';
import { TokenExchangeService } from './token-exchange.service';
import { IssuedAccessTokenService } from './issued-access-token.service';
import { RegisteredClientEntity } from './entities/registered-client.entity';
import { RefreshTokenEntity } from './entities/refresh-token.entity';
import { McpRefreshTokenEntity } from './entities/mcp-refresh-token.entity';
import { IssuedAccessTokenEntity } from './entities/issued-access-token.entity';
import { WebAuthController } from './web-auth.controller';
import { AuthJourneysModule } from '../auth-journeys/auth-journeys.module';
import { McpRegistryModule } from '../mcp-registry/mcp-registry.module';
import { IdentityProviderModule } from '../identity-provider/identity-provider.module';
import { AuthGuardsModule } from '../auth/guards/auth-guards.module';
import { McpConnectionEntity } from '../mcp-registry/entities/mcp-connection.entity';
import { McpScopeMappingEntity } from '../mcp-registry/entities/mcp-scope-mapping.entity';
import { ConnectionAuthorizationFlowEntity } from '../auth-journeys/entities/connection-authorization-flow.entity';
import { AuthCryptoModule } from '../auth/crypto/auth-crypto.module';
import { WebAuthService } from './web-auth.service';
import { RotateMcpRefreshTokenUseCase } from './use-cases/rotate-mcp-refresh-token.use-case';
import { RotateWebRefreshTokenUseCase } from './use-cases/rotate-web-refresh-token.use-case';
import { ConsumeMcpAuthorizationCodeUseCase } from './use-cases/consume-mcp-authorization-code.use-case';
import { RegisterClientUseCase } from './use-cases/register-client.use-case';
import { IssueMcpAuthorizationCodeUseCase } from './use-cases/issue-mcp-authorization-code.use-case';
import { StartMcpAuthorizationRequestUseCase } from './use-cases/start-mcp-authorization-request.use-case';
import { RejectMcpConsentUseCase } from './use-cases/reject-mcp-consent.use-case';
import { ApproveMcpConsentUseCase } from './use-cases/approve-mcp-consent.use-case';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      RegisteredClientEntity,
      RefreshTokenEntity,
      McpRefreshTokenEntity,
      IssuedAccessTokenEntity,
      McpConnectionEntity,
      McpScopeMappingEntity,
      ConnectionAuthorizationFlowEntity,
    ]),
    AuthJourneysModule,
    McpRegistryModule,
    IdentityProviderModule,
    AuthCryptoModule,
    AuthGuardsModule,
  ],
  providers: [
    ClientRegistrationService,
    AuthorizationService,
    TokenService,
    TokenExchangeService,
    IssuedAccessTokenService,
    WebAuthService,
    RotateMcpRefreshTokenUseCase,
    RotateWebRefreshTokenUseCase,
    ConsumeMcpAuthorizationCodeUseCase,
    RegisterClientUseCase,
    IssueMcpAuthorizationCodeUseCase,
    StartMcpAuthorizationRequestUseCase,
    RejectMcpConsentUseCase,
    ApproveMcpConsentUseCase,
  ],
  controllers: [
    ClientRegistrationController,
    AuthorizationController,
    WebAuthController,
  ],
  exports: [
    ClientRegistrationService,
    AuthorizationService,
    TokenService,
    TokenExchangeService,
    IssuedAccessTokenService,
  ],
})
export class AuthorizationServerModule {}
