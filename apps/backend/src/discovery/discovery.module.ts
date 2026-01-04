import { Module } from '@nestjs/common';
import { DiscoveryController } from './discovery.controller';
import { DiscoveryService } from './discovery.service';
import { McpRegistryModule } from '../mcp-registry/mcp-registry.module';
import { AuthorizationServerModule } from '../authorization-server/authorization-server.module';

@Module({
  imports: [McpRegistryModule, AuthorizationServerModule],
  controllers: [DiscoveryController],
  providers: [DiscoveryService],
})
export class DiscoveryModule {}
