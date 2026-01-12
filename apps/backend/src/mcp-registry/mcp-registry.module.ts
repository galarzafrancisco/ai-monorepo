import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { McpRegistryController } from './mcp-registry.controller';
import { McpRegistryService } from './mcp-registry.service';
import {
  McpServerEntity,
  McpScopeEntity,
  McpConnectionEntity,
  McpScopeMappingEntity,
} from './entities';
import { AuthJourneysModule } from '../auth-journeys/auth-journeys.module';
import { AuthorizationServerModule } from '../authorization-server/authorization-server.module';
import { AuthModule } from 'src/auth/auth.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      McpServerEntity,
      McpScopeEntity,
      McpConnectionEntity,
      McpScopeMappingEntity,
    ]),
    forwardRef(() => AuthJourneysModule),
    forwardRef(() => AuthorizationServerModule),
    // forwardRef(() => AuthModule),
  ],
  controllers: [McpRegistryController],
  providers: [McpRegistryService],
  exports: [McpRegistryService],
})
export class McpRegistryModule {}
