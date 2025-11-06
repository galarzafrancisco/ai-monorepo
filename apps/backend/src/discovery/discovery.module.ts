import { Module } from '@nestjs/common';
import { DiscoveryController } from './discovery.controller';
import { McpRegistryModule } from '../mcp-registry/mcp-registry.module';

@Module({
  imports: [McpRegistryModule],
  controllers: [DiscoveryController],
})
export class DiscoveryModule {}
