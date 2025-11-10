import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DocumentsModule } from './documents/documents.module';
import { HealthModule } from './health/health.module';
import { DiscoveryModule } from './discovery/discovery.module';

@Module({
  imports: [DocumentsModule, HealthModule, DiscoveryModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
