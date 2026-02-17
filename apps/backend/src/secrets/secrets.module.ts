import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SecretEntity } from './secret.entity';
import { SecretsService } from './secrets.service';
import { SecretsController } from './secrets.controller';
import { SecretsEncryptionService } from './secrets-encryption.service';
import { AuthGuardsModule } from '../auth/guards/auth-guards.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([SecretEntity]),
    AuthGuardsModule,
  ],
  controllers: [SecretsController],
  providers: [SecretsService, SecretsEncryptionService],
  exports: [SecretsService],
})
export class SecretsModule {}
