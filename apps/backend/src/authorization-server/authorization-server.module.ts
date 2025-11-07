import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ClientRegistrationService } from './client-registration.service';
import { ClientRegistrationController } from './client-registration.controller';
import { RegisteredClientEntity } from './registered-client.entity';
import { AuthJourneysModule } from 'src/auth-journeys/auth-journeys.module';
import { McpRegistryModule } from 'src/mcp-registry/mcp-registry.module';


@Module({
  imports: [
    TypeOrmModule.forFeature([RegisteredClientEntity]),
    AuthJourneysModule,
    McpRegistryModule,
  ],
  providers: [ClientRegistrationService],
  controllers: [ClientRegistrationController],
  exports: [ClientRegistrationService],
})
export class AuthorizationServerModule {}
