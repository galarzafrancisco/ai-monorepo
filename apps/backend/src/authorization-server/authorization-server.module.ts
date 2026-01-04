import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ClientRegistrationService } from './client-registration.service';
import { ClientRegistrationController } from './client-registration.controller';
import { AuthorizationService } from './authorization.service';
import { AuthorizationController } from './authorization.controller';
import { TokenService } from './token.service';
import { TokenExchangeService } from './token-exchange.service';
import { RegisteredClientEntity } from './registered-client.entity';
import { JwksKeyEntity } from './jwks-key.entity';
import { RefreshTokenEntity } from './refresh-token.entity';
import { JwksService } from './jwks.service';
import { JwksController } from './jwks.controller';
import { WebAuthController } from './web-auth.controller';
import { AuthJourneysModule } from 'src/auth-journeys/auth-journeys.module';
import { McpRegistryModule } from 'src/mcp-registry/mcp-registry.module';
import { IdentityProviderModule } from 'src/identity-provider/identity-provider.module';
import { McpConnectionEntity } from '../mcp-registry/entities/mcp-connection.entity';
import { McpScopeMappingEntity } from '../mcp-registry/entities/mcp-scope-mapping.entity';
import { ConnectionAuthorizationFlowEntity } from '../auth-journeys/entities/connection-authorization-flow.entity';


@Module({
  imports: [
    TypeOrmModule.forFeature([
      RegisteredClientEntity,
      JwksKeyEntity,
      RefreshTokenEntity,
      McpConnectionEntity,
      McpScopeMappingEntity,
      ConnectionAuthorizationFlowEntity,
    ]),
    AuthJourneysModule,
    McpRegistryModule,
    IdentityProviderModule,
  ],
  providers: [
    ClientRegistrationService,
    AuthorizationService,
    TokenService,
    TokenExchangeService,
    JwksService,
  ],
  controllers: [
    ClientRegistrationController,
    AuthorizationController,
    JwksController,
    WebAuthController,
  ],
  exports: [
    ClientRegistrationService,
    AuthorizationService,
    TokenService,
    TokenExchangeService,
    JwksService,
  ],
})
export class AuthorizationServerModule {}
