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
import { JwksService } from './jwks.service';
import { JwksController } from './jwks.controller';
import { AuthJourneysModule } from 'src/auth-journeys/auth-journeys.module';
import { McpRegistryModule } from 'src/mcp-registry/mcp-registry.module';
import { McpConnectionEntity } from '../mcp-registry/entities/mcp-connection.entity';
import { McpScopeMappingEntity } from '../mcp-registry/entities/mcp-scope-mapping.entity';
import { ConnectionAuthorizationFlowEntity } from '../auth-journeys/entities/connection-authorization-flow.entity';


@Module({
  imports: [
    TypeOrmModule.forFeature([
      RegisteredClientEntity,
      JwksKeyEntity,
      McpConnectionEntity,
      McpScopeMappingEntity,
      ConnectionAuthorizationFlowEntity,
    ]),
    AuthJourneysModule,
    McpRegistryModule,
  ],
  providers: [
    ClientRegistrationService,
    AuthorizationService,
    TokenService,
    TokenExchangeService,
    JwksService,
  ],
  controllers: [ClientRegistrationController, AuthorizationController, JwksController],
  exports: [
    ClientRegistrationService,
    AuthorizationService,
    TokenService,
    TokenExchangeService,
    JwksService,
  ],
})
export class AuthorizationServerModule {}
