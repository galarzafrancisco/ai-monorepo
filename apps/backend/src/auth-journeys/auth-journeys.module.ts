import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  AuthJourneyEntity,
  ConnectionAuthorizationFlowEntity,
  McpAuthorizationFlowEntity,
} from './entities';
import { AuthJourneysService } from './auth-journeys.service';
import { McpRegistryModule } from 'src/mcp-registry/mcp-registry.module';
import { AuthJourneysController } from './auth-journeys.controller';
import { AuthGuardsModule } from 'src/auth/guards/auth-guards.module';
import { AuthJourneysCleanupService } from './auth-journeys-cleanup.service';
import { RegisteredClientEntity } from 'src/authorization-server/entities/registered-client.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      AuthJourneyEntity,
      McpAuthorizationFlowEntity,
      ConnectionAuthorizationFlowEntity,
      RegisteredClientEntity,
    ]),
    McpRegistryModule,
    AuthGuardsModule,
  ],
  providers: [AuthJourneysService, AuthJourneysCleanupService],
  exports: [AuthJourneysService],
  controllers: [AuthJourneysController],
})
export class AuthJourneysModule {}
