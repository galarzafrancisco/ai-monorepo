import { Module } from '@nestjs/common';
import { DiscoveryService } from './discovery.service';
import { DiscoveryController } from './discovery.controller';

@Module({
  providers: [DiscoveryService],
  controllers: [DiscoveryController]
})
export class DiscoveryModule {}
