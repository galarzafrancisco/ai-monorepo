import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  AuthJourneyEntity,
  ConnectionAuthorizationFlowEntity,
  McpAuthorizationFlowEntity,
} from './entities';
import { AuthJourneysService } from './auth-journeys.service';
import { AuthJourneysController } from './auth-journeys.controller';
import { McpRegistryModule } from 'src/mcp-registry/mcp-registry.module';
import { AuthGuardsModule } from 'src/auth-guards/auth-guards.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      AuthJourneyEntity,
      McpAuthorizationFlowEntity,
      ConnectionAuthorizationFlowEntity,
    ]),
    forwardRef(() => McpRegistryModule),
    forwardRef(() => AuthGuardsModule),
  ],
  controllers: [AuthJourneysController],
  providers: [AuthJourneysService],
  exports: [AuthJourneysService],
})
export class AuthJourneysModule {}
