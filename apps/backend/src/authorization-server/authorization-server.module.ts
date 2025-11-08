import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ClientRegistrationService } from './client-registration.service';
import { ClientRegistrationController } from './client-registration.controller';
import { AuthorizationService } from './authorization.service';
import { AuthorizationController } from './authorization.controller';
import { RegisteredClientEntity } from './registered-client.entity';
import { JwksKeyEntity } from './jwks-key.entity';
import { JwksService } from './jwks.service';
import { JwksController } from './jwks.controller';
import { McpAuthorizationFlowEntity } from 'src/auth-journeys/entities';
import { AuthJourneysModule } from 'src/auth-journeys/auth-journeys.module';
import { McpRegistryModule } from 'src/mcp-registry/mcp-registry.module';


@Module({
  imports: [
    TypeOrmModule.forFeature([RegisteredClientEntity, McpAuthorizationFlowEntity, JwksKeyEntity]),
    AuthJourneysModule,
    McpRegistryModule,
  ],
  providers: [ClientRegistrationService, AuthorizationService, JwksService],
  controllers: [ClientRegistrationController, AuthorizationController, JwksController],
  exports: [ClientRegistrationService, AuthorizationService, JwksService],
})
export class AuthorizationServerModule {}
