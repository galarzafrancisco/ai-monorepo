import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  AuthJourneyEntity,
  ConnectionAuthorizationFlowEntity,
  McpAuthorizationFlowEntity,
} from './entities';
import { AuthJourneysService } from './auth-journeys.service';
import { McpRegistryModule } from 'src/mcp-registry/mcp-registry.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      AuthJourneyEntity,
      McpAuthorizationFlowEntity,
      ConnectionAuthorizationFlowEntity,
    ]),
    McpRegistryModule,
  ],
  providers: [AuthJourneysService],
  exports: [AuthJourneysService],
})
export class AuthJourneysModule {}
