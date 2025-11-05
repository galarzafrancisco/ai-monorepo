import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { McpRegistryController } from './mcp-registry.controller';
import { McpRegistryService } from './mcp-registry.service';
import {
  McpServerEntity,
  McpScopeEntity,
  McpConnectionEntity,
  McpScopeMappingEntity,
} from './entities';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      McpServerEntity,
      McpScopeEntity,
      McpConnectionEntity,
      McpScopeMappingEntity,
    ]),
  ],
  controllers: [McpRegistryController],
  providers: [McpRegistryService],
  exports: [McpRegistryService],
})
export class McpRegistryModule {}
