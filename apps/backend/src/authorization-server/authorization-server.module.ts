import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ClientRegistrationService } from './client-registration.service';
import { ClientRegistrationController } from './client-registration.controller';
import { RegisteredClientEntity } from './registered-client.entity';
import { AuthorizationServerMetadataController } from './authorization-server-metadata.controller';
import { McpRegistryModule } from '../mcp-registry/mcp-registry.module';

@Module({
  imports: [TypeOrmModule.forFeature([RegisteredClientEntity]), McpRegistryModule],
  providers: [ClientRegistrationService],
  controllers: [ClientRegistrationController, AuthorizationServerMetadataController],
  exports: [ClientRegistrationService],
})
export class AuthorizationServerModule {}
