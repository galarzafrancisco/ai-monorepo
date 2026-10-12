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
import { ClientIdMetadataService } from './client-id-metadata.service';
import { ClientAssertionService } from './client-assertion.service';
import {
  CLIENT_METADATA_FETCH_OPTIONS,
  ClientMetadataDocumentFetcher,
  DEFAULT_CLIENT_METADATA_FETCH_OPTIONS,
} from './client-metadata-document.fetcher';

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
    {
      provide: CLIENT_METADATA_FETCH_OPTIONS,
      useValue: DEFAULT_CLIENT_METADATA_FETCH_OPTIONS,
    },
    ClientMetadataDocumentFetcher,
    ClientIdMetadataService,
    ClientAssertionService,
    AuthorizationService,
    TokenService,
    TokenExchangeService,
    IssuedAccessTokenService,
    WebAuthService,
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
