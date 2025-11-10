import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DocumentsModule } from './documents/documents.module';
import { HealthModule } from './health/health.module';
import { DiscoveryModule } from './discovery/discovery.module';
import { AuthModule } from './auth/auth.module';

@Module({
  imports: [DocumentsModule, HealthModule, DiscoveryModule, AuthModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
